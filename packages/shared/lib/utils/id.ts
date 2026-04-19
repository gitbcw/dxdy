let counter = 0;

/** 生成简易唯一 ID（格式：前缀_时间戳_计数器） */
export function generateId(prefix: string): string {
  counter++;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
