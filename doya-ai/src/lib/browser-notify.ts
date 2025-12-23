// ブラウザ通知（Notification API）の薄いラッパー
// - App Router の client component からのみ利用する想定
// - iOS/Safari など環境によっては通知が無効/制限されるため、必ずフォールバックUI（toast等）も併用する

export const NOTIFY_PREF_KEY = 'doya-notify-on-complete'

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotificationSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    // Safari等で例外になるケースを吸収
    return Notification.permission
  }
}

export function readNotifyOnComplete(): boolean {
  try {
    const v = localStorage.getItem(NOTIFY_PREF_KEY)
    return v === 'true'
  } catch {
    return false
  }
}

export function writeNotifyOnComplete(next: boolean) {
  try {
    localStorage.setItem(NOTIFY_PREF_KEY, next ? 'true' : 'false')
  } catch {
    // ignore
  }
}

export function sendBrowserNotification(title: string, body: string) {
  if (!isBrowserNotificationSupported()) return
  if (Notification.permission !== 'granted') return
  // eslint-disable-next-line no-new
  new Notification(title, {
    body,
    // silent は環境によって通知が出ない/気づきにくい原因になることがあるので指定しない
  })
}


