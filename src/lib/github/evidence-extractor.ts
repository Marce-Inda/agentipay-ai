import type { CIStatus, GitHubEvidence } from '@/lib/types';

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  prNumber: number;
}

/**
 * GitHubEvidenceExtractor: Extract PR evidence from GitHub
 * Supports both authenticated (REST API v3) and unauthenticated (HTML scraping) modes.
 */
export class GitHubEvidenceExtractor {
  private githubToken: string | undefined;

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
  }

  /**
   * Validate a GitHub PR URL format
   */
  validatePRUrl(prUrl: string): boolean {
    try {
      this.parseGitHubUrl(prUrl);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse GitHub PR URL and extract owner, repo, and PR number
   * Pattern: https://github.com/owner/repo/pull/123
   */
  parseGitHubUrl(prUrl: string): ParsedGitHubUrl {
    const match = prUrl.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/);
    if (!match) {
      throw new Error(`Invalid GitHub PR URL format: ${prUrl}`);
    }

    return {
      owner: match[1],
      repo: match[2],
      prNumber: parseInt(match[3], 10),
    };
  }

  /**
   * Extract GitHub evidence from a PR URL
   * Uses authenticated API if token available, otherwise falls back to HTML parsing
   */
  async extractFromPRUrl(prUrl: string): Promise<GitHubEvidence> {
    const parsed = this.parseGitHubUrl(prUrl);

    try {
      if (this.githubToken) {
        return await this.extractWithAuth(parsed);
      } else {
        return await this.extractWithoutAuth(parsed);
      }
    } catch (error) {
      throw new Error(
        `Failed to extract GitHub evidence from ${prUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Extract evidence using authenticated GitHub REST API v3
   */
  private async extractWithAuth(parsed: ParsedGitHubUrl): Promise<GitHubEvidence> {
    const headers = {
      Authorization: `token ${this.githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'AgenticPay-Auditor/1.0',
    };

    // Fetch PR details
    const prUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.prNumber}`;
    const prResponse = await this.fetchWithTimeout(prUrl, { headers }, 10000);
    if (!prResponse.ok) {
      throw new Error(`GitHub API error: ${prResponse.status} ${prResponse.statusText}`);
    }
    const prData = (await prResponse.json()) as any;

    // Fetch files changed
    const filesUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.prNumber}/files`;
    const filesResponse = await this.fetchWithTimeout(filesUrl, { headers }, 10000);
    const filesData = filesResponse.ok ? ((await filesResponse.json()) as any[]) : [];

    // Fetch commit status (CI status)
    const statusUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits/${prData.head.sha}/status`;
    const statusResponse = await this.fetchWithTimeout(statusUrl, { headers }, 10000);
    const statusData = statusResponse.ok ? ((await statusResponse.json()) as any) : null;

    // Build file list
    const files = filesData.map((file: any) => ({
      name: file.filename.split('/').pop() || file.filename,
      path: file.filename,
      status: file.status as 'added' | 'modified' | 'deleted',
    }));

    // Build diff from files
    let fullDiff = '';
    for (const file of filesData) {
      if (file.patch) {
        fullDiff += file.patch + '\n';
      }
    }

    return {
      title: prData.title || '',
      description: prData.body || '',
      files,
      diff: fullDiff.substring(0, 1024 * 1024), // Limit to 1MB
      ciStatus: this.mapCIStatus(statusData?.state),
      merged: prData.merged === true,
      url: prData.html_url,
    };
  }

  /**
   * Extract evidence using unauthenticated GitHub public page access
   * Fetches the PR as raw diff and attempts basic HTML parsing
   */
  private async extractWithoutAuth(parsed: ParsedGitHubUrl): Promise<GitHubEvidence> {
    const prUrl = `https://github.com/${parsed.owner}/${parsed.repo}/pull/${parsed.prNumber}`;

    // Attempt to fetch PR patch
    const patchUrl = `${prUrl}.patch`;
    const patchResponse = await this.fetchWithTimeout(patchUrl, {}, 10000);
    if (!patchResponse.ok) {
      throw new Error(`GitHub PR not found: ${patchResponse.status} ${patchResponse.statusText}`);
    }

    const diff = await patchResponse.text();

    // Parse files from diff
    const files = this.parseFilesFromDiff(diff);

    // Basic info from diff headers
    const titleMatch = diff.match(/Subject: (.*?)(?:\n|$)/);
    const title = titleMatch ? titleMatch[1] : '';

    return {
      title,
      description: '[Extracted from GitHub PR page]',
      files,
      diff: diff.substring(0, 1024 * 1024), // Limit to 1MB
      ciStatus: 'unknown', // Cannot determine CI status without authentication
      merged: false, // Cannot determine merge status without authentication
      url: prUrl,
    };
  }

  /**
   * Parse unified diff format to extract files and their status
   */
  private parseFilesFromDiff(
    diff: string
  ): Array<{ name: string; path: string; status: 'added' | 'modified' | 'deleted' }> {
    const files: Array<{ name: string; path: string; status: 'added' | 'modified' | 'deleted' }> = [];
    const lines = diff.split('\n');

    let isNewFile = false;
    let isDeletedFile = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('diff --git')) {
        // Parse git diff header: diff --git a/path/to/file b/path/to/file
        const match = line.match(/diff --git a\/(.*) b\/(.*)/);
        if (match) {
          const filePath = match[2];
          isNewFile = false;
          isDeletedFile = false;

          // Look ahead for new file or deleted file indicators
          if (i + 1 < lines.length && lines[i + 1].startsWith('new file mode')) {
            isNewFile = true;
          }
          if (i + 1 < lines.length && lines[i + 1].startsWith('deleted file mode')) {
            isDeletedFile = true;
          }

          const status = isNewFile ? 'added' : isDeletedFile ? 'deleted' : 'modified';

          files.push({
            name: filePath.split('/').pop() || filePath,
            path: filePath,
            status,
          });
        }
      }
    }

    return files;
  }

  /**
   * Map GitHub API CI status to our standard format
   */
  private mapCIStatus(state: string | undefined | null): CIStatus {
    if (!state) return 'unknown';
    if (state === 'success') return 'success';
    if (state === 'failure') return 'failure';
    if (state === 'pending') return 'pending';
    return 'unknown';
  }

  /**
   * Fetch with timeout helper
   */
  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
