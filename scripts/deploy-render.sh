#!/bin/bash

# Script rápido para desplegar en Render
# Pega tu API Key cuando se te pida

echo "🚀 Despliegue en Render"
echo "======================"
echo ""

# Leer API Key del usuario
read -p "🔑 Ingresa tu Render API Key (rnd_xxx): " RENDER_API_KEY

if [ -z "$RENDER_API_KEY" ]; then
    echo "❌ API Key requerida. Ejecuta el script de nuevo."
    exit 1
fi

echo ""
echo "⏳ Iniciando despliegue..."

# Variables
SERVICE_NAME="agentic-pay-ai"
REPO_URL="https://github.com/marce-i/paypal-ai-hackathon"
BRANCH="main"
REGION="oregon"
PLAN="starter"

# Endpoint de Render
API_BASE="https://api.render.com/v1"

# Listar servicios
echo "📦 Verificando servicios existentes..."
SERVICES=$(curl -s -X GET "$API_BASE/services" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json")

# Verificar conexión
if ! echo "$SERVICES" | grep -q "service"; then
    echo "❌ Error: Verifica tu API Key"
    echo "$SERVICES" | jq -r '.error.message // .message // "Error desconocido"' 2>/dev/null || echo "$SERVICES"
    exit 1
fi

SERVICE_COUNT=$(echo "$SERVICES" | jq '. | length')
echo "   Servicios encontrados: $SERVICE_COUNT"
echo ""

# Verificar si el servicio ya existe
EXISTING=$(echo "$SERVICES" | jq -r --arg name "$SERVICE_NAME" '.[] | select(.name == $name) | .id')

if [ -n "$EXISTING" ]; then
    echo "⚠️  El servicio ya existe (ID: $EXISTING)"
    echo "   Iniciando nuevo despliegue..."
    
    curl -s -X POST "$API_BASE/services/$EXISTING/deploys" \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"clearCache": false}' | jq -r '.deploy.id // "Error"'
    
    echo ""
    echo "✅ Despliegue iniciado!"
    echo "   Dashboard: https://dashboard.render.com/service/$EXISTING"
else
    echo "➕ Creando nuevo servicio: $SERVICE_NAME"
    
    curl -s -X POST "$API_BASE/services" \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"service\": {
          \"name\": \"$SERVICE_NAME\",
          \"type\": \"web\",
          \"runtime\": \"node\",
          \"buildCommand\": \"npm ci && npm run build\",
          \"startCommand\": \"npm run start\",
          \"repo\": \"$REPO_URL\",
          \"branch\": \"$BRANCH\",
          \"region\": \"$REGION\",
          \"plan\": \"$PLAN\",
          \"autoDeploy\": \"yes\",
          \"envVars\": [
            {\"key\": \"NEXT_PUBLIC_PAYPAL_CLIENT_ID\", \"value\": \"placeholder\", \"type\": \"secret\" },
            {\"key\": \"PAYPAL_CLIENT_SECRET\", \"value\": \"placeholder\", \"type\": \"secret\" },
            {\"key\": \"PAYPAL_ENV\", \"value\": \"sandbox\" },
            {\"key\": \"GOOGLE_GENERATIVE_AI_API_KEY\", \"value\": \"placeholder\", \"type\": \"secret\" },
            {\"key\": \"OPENAI_API_KEY\", \"value\": \"placeholder\", \"type\": \"secret\" }
          ]
        }
      }" | jq -r '.service.id // "Error"'
    
    echo ""
    echo "✅ Servicio creado y despliegue iniciado!"
    echo "   (Revisa el ID arriba y ve al dashboard)"
fi

echo ""
echo "📌 Tiempo estimado: 5-10 minutos"
echo "   https://dashboard.render.com"
