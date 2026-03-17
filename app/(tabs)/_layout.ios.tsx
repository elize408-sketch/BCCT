
import React from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger key="home" name="(home)">
        <Icon sf="house.fill" />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="chat" name="chat">
        <Icon sf="message.circle.fill" />
        <Label>Chat</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="documenten" name="documenten">
        <Icon sf="folder.fill" />
        <Label>Documenten</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="profiel" name="profiel">
        <Icon sf="person.fill" />
        <Label>Profiel</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
