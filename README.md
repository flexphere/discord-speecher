# Speecher
DiscordでVC声なし参加者のチャットを読み上げてくれるよくあるアレ

## 導入
1. Google Cloud Platform で Text-to-Speech API が使用可能なサービスアカウントを作成
2. 作成したサービスアカウントの鍵をJSON形式で作成し、`key.json` として保存
3. (Discord Developer Portal)[https://discord.com/developers] でBotを作成し、Tokenを取得
4. `docker-compose.yml` の 「__YOUR_DISCORD_API_KEY__」を取得したTokenに置換

## 実行
```sh
docker-compose up
```