import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated, ViewStyle } from 'react-native'
import { Colors, Spacing, BorderRadius } from '../constants/theme'

interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

/**
 * Single skeleton loading placeholder with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = BorderRadius.sm,
  style,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    )
    shimmer.start()
    return () => shimmer.stop()
  }, [shimmerAnim])

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  })

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  )
}

/**
 * Project card skeleton for HomeScreen, SearchScreen
 */
export const ProjectCardSkeleton: React.FC = () => {
  return (
    <View style={styles.projectCard}>
      <Skeleton width="100%" height={120} borderRadius={BorderRadius.lg} />
      <View style={styles.projectCardContent}>
        <Skeleton width="70%" height={20} />
        <Skeleton width="50%" height={16} style={{ marginTop: Spacing.xs }} />
        <View style={styles.projectCardMeta}>
          <Skeleton width={60} height={14} />
          <Skeleton width={60} height={14} />
          <Skeleton width={60} height={14} />
        </View>
      </View>
    </View>
  )
}

/**
 * Activity item skeleton for ActivityScreen
 */
export const ActivityItemSkeleton: React.FC = () => {
  return (
    <View style={styles.activityItem}>
      <Skeleton width={48} height={48} borderRadius={24} />
      <View style={styles.activityContent}>
        <Skeleton width="80%" height={16} />
        <Skeleton width="60%" height={14} style={{ marginTop: Spacing.xxs }} />
        <Skeleton width={80} height={12} style={{ marginTop: Spacing.xxs }} />
      </View>
    </View>
  )
}

/**
 * User card skeleton for SearchScreen, CollaboratorsScreen
 */
export const UserCardSkeleton: React.FC = () => {
  return (
    <View style={styles.userCard}>
      <Skeleton width={56} height={56} borderRadius={28} />
      <View style={styles.userCardContent}>
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" height={14} style={{ marginTop: Spacing.xxs }} />
      </View>
      <Skeleton width={80} height={36} borderRadius={BorderRadius.md} />
    </View>
  )
}

/**
 * Audio file/stem item skeleton for ProjectStudio, AudioUpload
 */
export const AudioFileSkeleton: React.FC = () => {
  return (
    <View style={styles.audioFile}>
      <Skeleton width={40} height={40} borderRadius={BorderRadius.sm} />
      <View style={styles.audioFileContent}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="40%" height={14} style={{ marginTop: Spacing.xxs }} />
      </View>
      <Skeleton width={24} height={24} borderRadius={12} />
    </View>
  )
}

/**
 * Comment skeleton for ProjectStudio, ProjectDetail
 */
export const CommentSkeleton: React.FC = () => {
  return (
    <View style={styles.comment}>
      <Skeleton width={32} height={32} borderRadius={16} />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Skeleton width={100} height={14} />
          <Skeleton width={60} height={12} />
        </View>
        <Skeleton width="90%" height={14} style={{ marginTop: Spacing.xs }} />
        <Skeleton width="70%" height={14} style={{ marginTop: Spacing.xxs }} />
      </View>
    </View>
  )
}

/**
 * List of skeletons - renders multiple skeleton items
 */
interface SkeletonListProps {
  count?: number
  type?: 'project' | 'activity' | 'user' | 'audio' | 'comment'
}

export const SkeletonList: React.FC<SkeletonListProps> = ({ count = 3, type = 'project' }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'project':
        return <ProjectCardSkeleton />
      case 'activity':
        return <ActivityItemSkeleton />
      case 'user':
        return <UserCardSkeleton />
      case 'audio':
        return <AudioFileSkeleton />
      case 'comment':
        return <CommentSkeleton />
      default:
        return <Skeleton />
    }
  }

  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={{ marginBottom: Spacing.sm }}>
          {renderSkeleton()}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.surface,
  },
  projectCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  projectCardContent: {
    padding: Spacing.md,
  },
  projectCardMeta: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  userCardContent: {
    flex: 1,
  },
  audioFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  audioFileContent: {
    flex: 1,
  },
  comment: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
})

export default Skeleton
