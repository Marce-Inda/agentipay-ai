#!/bin/bash

# Script para desplegar en Render usando la API directa
# Requiere RENDER_API_KEY en las variables de entorno

set -e

echo "🚀 Desplegando en Render..."
echo ""

# Verificar API Key
if [ -z "$RENDER_API_KEY" ]; then
    echo "❌ RENDER_API_KEY no está definida"
    echo ""
    echo "Crea un archivo .env.render con tu API Key:"
    echo "  RENDER_API_KEY=rnd_xxxxxxxxxxxxxxxxxxxxxxxx"
    echo ""
    echo "O usa la API Key de tu MCP config en ~/.kiro/settings/mcp.json"
    exit 1
fi

# Configuración
API_BASE="https://api.render.com/v1"
SERVICE_NAME="agentic-pay-ai"
REPO_URL="https://github.com/marce-i/paypal-ai-hackathon"
BRANCH="main"
REGION="oregon"
PLAN="starter"

echo "📋 Configuración:"
echo "  Service: $SERVICE_NAME"
echo "  Repo: $REPO_URL"
echo "  Branch: $BRANCH"
echo "  Region: $REGION"
echo "  Plan: $PLAN"
echo ""

# Listar servicios para verificar conexión
echo "📦 Listando servicios en Render..."
SERVICES=$(curl -s -X GET "$API_BASE/services" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json")

if echo "$SERVICES" | grep -q "error"; then
    echo "❌ Error en la conexión con Render API"
    echo "$SERVICES"
    exit 1
fi

echo "✅ Conectado con éxito a Render API"
echo ""

# Contar servicios
SERVICE_COUNT=$(echo "$SERVICES" | jq '. | length')
echo "📊 Servicios encontrados: $SERVICE_COUNT"
echo ""

if [ "$SERVICE_COUNT" -gt 0 ]; then
    echo "🔧 Servicios existentes:"
    echo "$SERVICES" | jq -r '.[].name'
    echo ""
fi

# Verificar si el servicio ya existe
EXISTING_SERVICE=$(echo "$SERVICES" | jq -r --arg name "$SERVICE_NAME" '.[] | select(.name == $name) | .id')

if [ -n "$EXISTING_SERVICE" ]; then
    echo "⚠️  El servicio '$SERVICE_NAME' ya existe (ID: $EXISTING_SERVICE)"
    echo ""
    echo "¿Deseas desplegar una nueva versión? (y/n)"
    read -r RESPONSE
    if [ "$RESPONSE" != "y" ]; then
        echo "❌ Despliegue cancelado"
        exit 0
    fi
else
    echo "➕ Creando nuevo servicio web..."
    
    # Crear el servicio
    RESPONSE=$(curl -s -X POST "$API_BASE/services" \
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
            {\"key\": \"PAYPAL_ENV\", \"value\": \"sandbox\", \"type\": \"normal\" },
            {\"key\": \"GOOGLE_GENERATIVE_AI_API_KEY\", \"value\": \"placeholder\", \"type\": \"secret\" },
            {\"key\": \"OPENAI_API_KEY\", \"value\": \"placeholder\", \"type\": \"secret\" }
          ]
        }
      }")

    if echo "$RESPONSE" | grep -q "error"; then
        echo "❌ Error al crear el servicio"
        echo "$RESPONSE"
        exit 1
    fi

    NEW_SERVICE_ID=$(echo "$RESPONSE" | jq -r '.service.id')
    echo "✅ Servicio creado con ID: $NEW_SERVICE_ID"
    echo ""
    echo "⏳ Despliegue iniciado..."
    echo "   Ve a: https://dashboard.render.com/service/$NEW_SERVICE_ID"
    echo ""
fi

# Si ya existía, desplegar manualmente
if [ -n "$EXISTING_SERVICE" ]; then
    echo "🔄 Desplegando servicio $EXISTING_SERVICE..."
    
    DEPLOY_RESPONSE=$(curl -s -X POST "$API_BASE/services/$EXISTING_SERVICE/deploys" \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"clearCache": false}')
    
    if echo "$DEPLOY_RESPONSE" | grep -q "error"; then
        echo "❌ Error al iniciar el despliegue"
        echo "$DEPLOY_RESPONSE"
        exit 1
    fi
    
    DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | jq -r '.deploy.id')
    echo "✅ Despliegue iniciado (ID: $DEPLOY_ID)"
    echo ""
    echo "⏳ Monitoriza en: https://dashboard.render.com/service/$EXISTING_SERVICE"
    echo ""
fi

echo "🎉 Despliegue completado!"
echo ""
echo "📌 Próximos pasos:"
echo "   1. Espera a que el despliegue termine (5-10 min)"
echo "   2. Verifica los logs en el Dashboard"
echo "   3. Ajusta las variables de entorno si es necesario"
echo ""
