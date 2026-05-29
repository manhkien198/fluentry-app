import React from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { t } from './i18n';
import { colors } from './theme';

type State = { hasError: boolean; message: string };

export class CrashBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || t('crash.unexpected_error') };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>{t('crash.title')}</Text>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>{this.state.message}</Text>
        <Button mode="contained" onPress={() => this.setState({ hasError: false, message: '' })}>{t('crash.try_again')}</Button>
      </View>
    );
  }
}
