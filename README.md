# Speecher
DiscordでVC声なし参加者のチャットを読み上げてくれるよくあるアレ

## 導入
1. [Google Cloud Platform](https://console.cloud.google.com) で Text-to-Speech API が使用可能なサービスアカウントを作成
2. 作成したサービスアカウントの鍵をJSON形式で作成し、`key.json` として保存
3. [Discord Developer Portal](https://discord.com/developers) でBotを作成し、Tokenを取得
4. `docker-compose.yml` の 「${\_\_YOUR_DISCORD_API_KEY\_\_}」に環境変数を渡すために、下記のようにexportするようにShell環境を設定してください。

```
export __YOUR_DISCORD_API_KEY__=取得したDiscord API Key
```

## 実行
```sh
docker-compose up
```
