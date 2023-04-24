interface VoiceConfig {
  type: string;
  rate: number;
  pitch: number;
  active: number;
  filter: string;
}

interface SpeechQueue {
  channel: import("discord.js").VoiceChannel;
  content: string;
}

interface SpeechMessage {
  member: import("discord.js").GuildMember;
  textChannel: import("discord.js").TextChannel;
  voiceChannel: import("discord.js").VoiceChannel;
  content: string;
}

interface FilterResponseVoice {
  type?: string;
  speed?: number;
  pitch?: number;
}

interface FilterResponse {
  content: string;
  language?: string;
  voice?: FilterResponseVoice;
}

type RequiredAndNotNull<T> = {
  [P in keyof T]-?: Exclude<T[P], null | undefined>;
};

type RequireAndNotNullSome<T, K extends keyof T> = RequiredAndNotNull<
  Pick<T, K>
> &
  Omit<T, K>;

type Message = RequireAndNotNullSome<
  import("discord.js").Message,
  "member" | "channel"
>;
