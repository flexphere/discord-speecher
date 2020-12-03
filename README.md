# Speecher
DiscordでVC声なし参加者のチャットを読み上げてくれるよくあるアレ

## 導入
1. [Google Cloud Platform](https://console.cloud.google.com) で Text-to-Speech API が使用可能なサービスアカウントを作成
2. 作成したサービスアカウントの鍵をJSON形式で作成し、`key.json` として保存
3. [Discord Developer Portal](https://discord.com/developers) でBotを作成し、Tokenを取得
4. `docker-compose.yml` に環境変数を渡すために、下記のようにexportするようにShell環境を設定してください。

```
export DISCORD_TOKEN=取得したDiscord API Key
```

## 実行
```sh
docker-compose up
```

## フィルタAPI
入力されたテキストを発話する前に外部のAPIにて加工できます。  
APIを作成する場合には以下のインターフェースに従い実装し、API名・エンドポイントを`FilterApis`に追加してください。


### Request
Method: `POST`  
ContentType: `application/json`  
Body:
```
{
  content: string   // 入力されたテキスト
  voice: {
    type: string    // 発言者の音声名
    pitch: number   // 発言者の声の高さ [-20〜20]
    speed: number   // 発言者の声の速さ [0.25〜20]
  }
}
```

### Response
```
{
  content: string               // 変換されたテキスト
  language: string (optional)   // 言語名
  voice: {
    type : string  (optional)   // 音声名
    pitch: number  (optional)   // 声の高さ [-20〜20]
    speed: number  (optional)   // 声の速さ [0.25〜20]
  }
}
```

#### 参考
[> サポートされている言語・音声名](https://cloud.google.com/text-to-speech/docs/voices?hl=ja)  
[> pitch / speed(speakingRate)](https://cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/text/synthesize?hl=ja#AudioConfig)
