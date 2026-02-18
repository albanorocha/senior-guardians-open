#!/bin/bash
# Script para iniciar o servidor de desenvolvimento facilmente

# Carregar NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Iniciar o projeto
echo "Iniciando Senior Guardians..."
npm run dev
