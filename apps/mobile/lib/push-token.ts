import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { createClient } from './supabase'

export async function registerPushToken(userId: string) {
  if (!Device.isDevice) return

  const { status: existing } = await Notifications.getPermissionsAsync()
  const { status } = existing === 'granted'
    ? { status: existing }
    : await Notifications.requestPermissionsAsync()

  if (status !== 'granted') return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    })
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: '12deb875-4ef1-49e3-aef8-2855bee8da99',
  })

  const supabase = createClient()
  await supabase.from('users').update({ push_token: token }).eq('id', userId)
}
