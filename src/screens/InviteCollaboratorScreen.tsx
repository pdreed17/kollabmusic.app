import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import CompactHeader from '../components/CompactHeader'
import { checkIfBlocked } from '../utils/blockingHelpers'

const ROLES = [
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full access - can edit, delete, invite, and manage everything',
    icon: 'shield-checkmark',
    permissions: {
      can_edit: true,
      can_delete: true,
      can_invite: true,
      can_upload: true,
      can_comment: true,
      can_download: true
    }
  },
  {
    value: 'editor',
    label: 'Editor',
    description: 'Can upload, edit, and comment on files',
    icon: 'create',
    permissions: {
      can_edit: true,
      can_delete: false,
      can_invite: false,
      can_upload: true,
      can_comment: true,
      can_download: true
    }
  }
]

export default function InviteCollaboratorScreen({ route, navigation }: any) {
  const { projectId } = route.params
  const { user } = useAuth()
  const [username, setUsername] = useState('')
  const [selectedRole, setSelectedRole] = useState('editor')
  const [searching, setSearching] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [userSuggestions, setUserSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Search for users as they type
  useEffect(() => {
    const searchUsers = async () => {
      if (username.trim().length < 2) {
        setUserSuggestions([])
        setShowSuggestions(false)
        return
      }

      setSearching(true)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, display_name, avatar_url')
          .ilike('username', `${username.trim()}%`)
          .neq('id', user?.id) // Don't show current user
          .limit(5)

        if (!error && data) {
          setUserSuggestions(data)
          setShowSuggestions(data.length > 0)
        }
      } catch (error) {
        console.error('Error searching users:', error)
      } finally {
        setSearching(false)
      }
    }

    const delaySearch = setTimeout(() => {
      searchUsers()
    }, 300) // Debounce search

    return () => clearTimeout(delaySearch)
  }, [username, user?.id])

  const selectUser = (selectedUser: any) => {
    setUsername(selectedUser.username)
    setShowSuggestions(false)
  }

  const handleInvite = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username')
      return
    }

    setInviting(true)

    try {
      // Find user by username
      const { data: inviteeUser, error: userError } = await supabase
        .from('users')
        .select('id, username, display_name')
        .eq('username', username.trim().toLowerCase())
        .single()

      if (userError || !inviteeUser) {
        Alert.alert('Error', 'User not found')
        setInviting(false)
        return
      }

      // Check if user is trying to invite themselves
      if (inviteeUser.id === user?.id) {
        Alert.alert('Error', 'You cannot invite yourself')
        setInviting(false)
        return
      }

      // Check if blocked
      const isBlocked = await checkIfBlocked(user!.id, inviteeUser.id)
      if (isBlocked) {
        Alert.alert('Cannot Invite', 'You have blocked this user or they have blocked you')
        setInviting(false)
        return
      }

      // Check if already a collaborator
      const { data: existingCollab, error: checkError } = await supabase
        .from('project_collaborators')
        .select('id, invitation_status')
        .eq('project_id', projectId)
        .eq('user_id', inviteeUser.id)
        .maybeSingle()

      if (checkError) throw checkError

      if (existingCollab) {
        if (existingCollab.invitation_status === 'accepted') {
          Alert.alert('Already a Kollaborator', 'This user is already kollaborating on this project')
        } else if (existingCollab.invitation_status === 'pending') {
          Alert.alert('Invitation Pending', 'This user already has a pending invitation')
        } else {
          Alert.alert('Already Invited', 'This user was previously invited')
        }
        setInviting(false)
        return
      }

      // Get role permissions
      const roleData = ROLES.find(r => r.value === selectedRole)
      if (!roleData) throw new Error('Invalid role')

      // Create invitation
      const { error: inviteError } = await supabase
        .from('project_collaborators')
        .insert({
          project_id: projectId,
          user_id: inviteeUser.id,
          role: selectedRole,
          invitation_status: 'pending',
          invited_by: user?.id,
          ...roleData.permissions
        })

      if (inviteError) throw inviteError

      // TODO: Create notification for the invited user
      // This will be implemented when we build the notifications system

      Alert.alert(
        'Invitation Sent!',
        `${inviteeUser.display_name || inviteeUser.username} has been invited to kollab`,
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      )
    } catch (error: any) {
      console.error('Error inviting kollaborator:', error)
      Alert.alert('Error', error.message || 'Failed to invite kollaborator')
    } finally {
      setInviting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <CompactHeader
        title="Invite Kollaborator"
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Username Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Username</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="at" size={20} color={Colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Enter username"
              placeholderTextColor={Colors.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={Colors.primary} />}
          </View>

          {/* User Suggestions Dropdown */}
          {showSuggestions && userSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {userSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.id}
                  style={styles.suggestionItem}
                  onPress={() => selectUser(suggestion)}
                >
                  <View style={styles.suggestionInfo}>
                    <Text style={styles.suggestionUsername}>@{suggestion.username}</Text>
                    {suggestion.display_name && (
                      <Text style={styles.suggestionDisplayName}>{suggestion.display_name}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.helperText}>
            {showSuggestions && userSuggestions.length > 0
              ? 'Tap a username to select'
              : 'Start typing to see suggestions'
            }
          </Text>
        </View>

        {/* Role Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Role</Text>
          <Text style={styles.sectionSubtitle}>
            Choose what level of access this kollaborator will have
          </Text>

          {ROLES.map((role) => (
            <TouchableOpacity
              key={role.value}
              style={[
                styles.roleCard,
                selectedRole === role.value && styles.roleCardSelected
              ]}
              onPress={() => setSelectedRole(role.value)}
            >
              <View style={styles.roleHeader}>
                <View style={[
                  styles.roleIcon,
                  selectedRole === role.value && styles.roleIconSelected
                ]}>
                  <Ionicons
                    name={role.icon as any}
                    size={24}
                    color={selectedRole === role.value ? Colors.primary : Colors.textSecondary}
                  />
                </View>
                <View style={styles.roleInfo}>
                  <Text style={[
                    styles.roleLabel,
                    selectedRole === role.value && styles.roleLabelSelected
                  ]}>
                    {role.label}
                  </Text>
                  <Text style={styles.roleDescription}>
                    {role.description}
                  </Text>
                </View>
                {selectedRole === role.value && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                )}
              </View>

              {/* Permissions List */}
              <View style={styles.permissionsList}>
                {role.permissions.can_upload && (
                  <View style={styles.permissionItem}>
                    <Ionicons name="cloud-upload" size={16} color={Colors.success} />
                    <Text style={styles.permissionText}>Upload files</Text>
                  </View>
                )}
                {role.permissions.can_edit && (
                  <View style={styles.permissionItem}>
                    <Ionicons name="create" size={16} color={Colors.success} />
                    <Text style={styles.permissionText}>Edit project</Text>
                  </View>
                )}
                {role.permissions.can_delete && (
                  <View style={styles.permissionItem}>
                    <Ionicons name="trash" size={16} color={Colors.success} />
                    <Text style={styles.permissionText}>Delete files</Text>
                  </View>
                )}
                {role.permissions.can_invite && (
                  <View style={styles.permissionItem}>
                    <Ionicons name="person-add" size={16} color={Colors.success} />
                    <Text style={styles.permissionText}>Invite others</Text>
                  </View>
                )}
                {role.permissions.can_comment && (
                  <View style={styles.permissionItem}>
                    <Ionicons name="chatbubble" size={16} color={Colors.success} />
                    <Text style={styles.permissionText}>Comment</Text>
                  </View>
                )}
                {role.permissions.can_download && (
                  <View style={styles.permissionItem}>
                    <Ionicons name="download" size={16} color={Colors.success} />
                    <Text style={styles.permissionText}>Download files</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Invite Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.inviteButton, inviting && styles.inviteButtonDisabled]}
            onPress={handleInvite}
            disabled={inviting || !username.trim()}
          >
            {inviting ? (
              <ActivityIndicator color={Colors.text} size="small" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={20} color={Colors.text} />
                <Text style={styles.inviteButtonText}>Send Invitation</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
  },
  helperText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  roleCard: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  roleCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  roleIconSelected: {
    backgroundColor: `${Colors.primary}20`,
  },
  roleInfo: {
    flex: 1,
  },
  roleLabel: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  roleLabelSelected: {
    color: Colors.primary,
  },
  roleDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.success}10`,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  permissionText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '600',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  inviteButtonDisabled: {
    opacity: 0.5,
  },
  inviteButtonText: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },
  suggestionsContainer: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionUsername: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '600',
  },
  suggestionDisplayName: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
})