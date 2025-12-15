import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import { verticalScale, scale, moderateScale } from '../utils/responsive';

interface ThinHeaderProps {
  screenName: string;
}

const styles = StyleSheet.create({
  container: {
    height: verticalScale(64),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  screenName: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 1.2,
  },
  logo: {
    height: verticalScale(64),
    width: scale(50),
  },
});

export default function ThinHeader({ screenName }: ThinHeaderProps) {
  const isHomeScreen = screenName.toLowerCase() === 'home';

  return (
    <View style={styles.container}>
      {isHomeScreen ? (
        <Image
          source={require('../../assets/logo-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      ) : (
        <Text style={styles.screenName}>{screenName.toUpperCase()}</Text>
      )}
    </View>
  );
}
