interface VoiceConfig {
  type: string
  rate: number
  pitch: number
  active: number
  filter: string
}

interface SpeechQueue {
  channel: Discord.VoiceChannel
  content: string
}

interface SpeechMessage {
  member: Discord.GuildMember
  textChannel: Discord.TextChannel
  voiceChannel: Discord.VoiceChannel
  content: string
}

interface FilterResponseVoice {
  type?: string
  speed?: number
  pitch?: number
}

interface FilterResponse {
  content: string
  language?: string
  voice?: FilterResponseVoice
}

type RequiredAndNotNull<T> = {
  [P in keyof T]-?: Exclude<T[P], null | undefined>
}

type RequireAndNotNullSome<T, K extends keyof T> = RequiredAndNotNull<Pick<T, K>> & Omit<T, K>;

type Message = RequireAndNotNullSome<Discord.Message, 'member' | 'channel'>
