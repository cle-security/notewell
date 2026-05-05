FROM node:lts

USER root
RUN apt-get update && apt-get install -y zsh zstd && rm -rf /var/lib/apt/lists/* && npm install --global corepack@latest

RUN mkdir -p /home/node/.zsh_history_dir && chown node:node /home/node/.zsh_history_dir

USER node
RUN curl -fsSL https://claude.ai/install.sh | bash \
    && echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
