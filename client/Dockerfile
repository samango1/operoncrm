FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install -g npm@11.7.0

RUN npm install

RUN npx prettier --write .

COPY . .

RUN npm run build

CMD [ "npm", "run", "start" ]
