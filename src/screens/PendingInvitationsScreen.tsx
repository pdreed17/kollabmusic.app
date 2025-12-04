import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import Header from '../components/Header'

interface Invitation {
  id: string
  project_id: string
  role: string
  created_at: string | null
  invited_by?: string | null
  project: {
    id?: string
    title: string
    genre: string | null
  }
  invited_by_user: {
    id?: string
    username: string
    display_name?: string | null
  }
}

export default function PendingInvitationsScreen({ navigation }: any) {
  const { user } = useAuth()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    loadInvitations()
  }, [])

  const loadInvitations = async () => {
    try {
      if (!user?.id) return

      // Get pending invitations
      const { data: inviteData, error: inviteError } = await supabase
        .from('collaborators')
        .select('id, project_id, role, created_at, invited_by')
        .eq('user_id', user.id)
        .eq('invitation_status', 'pending')
        .order('created_at', { ascending: false })

      if (inviteError) throw inviteError

      if (!inviteData || inviteData.length === 0) {
        setInvitations([])
        setLoading(false)
        return
      }

      // Get project details
      const projectIds = inviteData.map(i => i.project_id)
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('id, title, genre')
        .in('id', projectIds)

      if (projectError) throw projectError

      // Get inviter details
      const inviterIds = inviteData
        .map(i => i.invited_by)
        .filter((id): id is string => id !== null && id !== undefined)
      const { data: inviters, error: inviterError } = await supabase
        .from('users')
        .select('id, username, display_name')
        .in('id', inviterIds)

      if (inviterError) throw inviterError

      // Combine data
      const enriched = inviteData.map(invite => ({
        ...invite,
        project: projects?.find(p => p.id === invite.project_id) || { title: 'Unknown Project', genre: null },
        invited_by_user: inviters?.find(u => u.id === invite.invited_by) || { username: 'Unknown', display_name: 'Unknown User' }
      }))

      setInvitations(enriched)
    } catch (error) {
      console.error('Error loading invitations:', error)
      Alert.alert('Error', 'Failed to load invitations')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (invitation: Invitation) => {
    setProcessing(invitation.id)
    try {
      const { error } = await supabase
        .from('collaborators')
        .update({
          invitation_status: 'accepted',
          invitation_accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id)

      if (error) throw error

      setInvitations(prev => prev.filter(i => i.id !== invitation.id))
      Alert.alert('Success', 'Invitation accepted!')
    } catch (error) {
      console.error('Error accepting invitation:', error)
      Alert.alert('Error', 'Failed to accept invitation')
    } finally {
      setProcessing(null)
    }
  }

  const handleDecline = async (invitation: Invitation) => {
    Alert.alert(
      'Decline Invitation',
      'Are you sure you want to decline this invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessing(invitation.id)
            try {
              const { error } = await supabase
                .from('collaborators')
                .update({ invitation_status: 'declined' })
                .eq('id', invitation.id)

              if (error) throw error

              setInvitations(prev => prev.filter(i => i.id !== invitation.id))
              Alert.alert('Declined', 'Invitation declined')
            } catch (error) {
              console.error('Error declining invitation:', error)
              Alert.alert('Error', 'Failed to decline invitation')
            } finally {
              setProcessing(null)
            }
          }
        }
      ]
    )
  }

  const renderInvitation = ({ item }: { item: Invitation }) => (
    <View style={styles.invitationCard}>
      <View style={styles.invitationHeader}>
        <View style={styles.projectIcon}>
          <Ionicons name="musical-notes" size={24} color={Colors.primary} />
        </View>
        <View style={styles.invitationInfo}>
          <Text style={styles.projectTitle}>{item.project.title}</Text>
          <Text style={styles.invitedBy}>
            Invited by {item.invited_by_user.display_name || item.invited_by_user.username}
          </Text>
          <View style={styles.metadata}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{item.role}</Text>
            </View>
            {item.project.genre && (
              <Text style={styles.genreText}>{item.project.genre}</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={() => handleAccept(item)}
          disabled={processing === item.id}
        >
          {processing === item.id ? (
            <ActivityIndicator size="small" color={Colors.text} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={Colors.text} />
              <Text style={styles.buttonText}>Accept</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.declineButton]}
          onPress={() => handleDecline(item)}
          disabled={processing === item.id}
        >
          <Ionicons name="close" size={20} color={Colors.error} />
          <Text style={[styles.buttonText, styles.declineText]}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Pending Invitations"
          variant="compact"
          showBack={true}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Pending Invitations"
        variant="compact"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={invitations}
        renderItem={renderInvitation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="mail-open-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No pending invitations</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: Spacing.md,
  },
  invitationCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  invitationHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  projectIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  invitationInfo: {
    flex: 1,
  },
  projectTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xxs,
  },
  invitedBy: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  metadata: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  roleBadge: {
    backgroundColor: `${Colors.primary}30`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  roleText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  genreText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  acceptButton: {
    backgroundColor: Colors.primary,
  },
  declineButton: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  declineText: {
    color: Colors.error,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
})