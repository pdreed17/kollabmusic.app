import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import Header from '../components/Header'

export default function CreateProjectScreen({ navigation }: any) {
  const { user, userProfile } = useAuth()
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [key, setKey] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [lookingForCollaborators, setLookingForCollaborators] = useState(false)
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a project title')
      return
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated')
      return
    }

    setCreating(true)

    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          creator_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          genre: genre.trim() || null,
          bpm: bpm ? parseInt(bpm) : null,
          key: key.trim() || null,
          is_public: isPublic,
          looking_for_collaborators: lookingForCollaborators,
          status: 'active',
        })
        .select()
        .single()

      if (error) throw error

      // Add creator as owner collaborator
      const { error: collabError } = await supabase
        .from('collaborators')
        .insert({
          project_id: project.id,
          user_id: user.id,
          role: 'owner',
          invitation_status: 'accepted',
          can_edit: true,
          can_delete: true,
          can_invite: true,
          can_upload: true,
          can_comment: true,
          can_download: true,
        })

      if (collabError) throw collabError

      Alert.alert('Success', 'Project created!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('ProjectDetail', { projectId: project.id })
        }
      ])
    } catch (error: any) {
      console.error('Error creating project:', error)
      Alert.alert('Error', 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="New Project"
        variant="compact"
        showBack={true}
        onBack={() => navigation.goBack()}
        showProfile={true}
        onProfilePress={() => navigation.navigate('Profile')}
        profilePhotoUrl={userProfile?.avatar_url}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Project Title */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Project Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="My Awesome Track"
              placeholderTextColor={Colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
          </View>

          {/* Description */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell collaborators about your project..."
              placeholderTextColor={Colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Genre */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Genre</Text>
            <TextInput
              style={styles.input}
              placeholder="Hip Hop, Rock, Electronic..."
              placeholderTextColor={Colors.textSecondary}
              value={genre}
              onChangeText={setGenre}
            />
          </View>

          {/* BPM and Key */}
          <View style={styles.rowGroup}>
            <View style={[styles.formGroup, styles.halfWidth]}>
              <Text style={styles.label}>BPM</Text>
              <TextInput
                style={styles.input}
                placeholder="120"
                placeholderTextColor={Colors.textSecondary}
                value={bpm}
                onChangeText={setBpm}
                keyboardType="number-pad"
              />
            </View>

            <View style={[styles.formGroup, styles.halfWidth]}>
              <Text style={styles.label}>Key</Text>
              <TextInput
                style={styles.input}
                placeholder="C Minor"
                placeholderTextColor={Colors.textSecondary}
                value={key}
                onChangeText={setKey}
              />
            </View>
          </View>

          {/* Public/Private Toggle */}
          <View style={styles.toggleSection}>
            <View style={styles.toggleHeader}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Public Project</Text>
                <Text style={styles.toggleDescription}>
                  Allow others to discover this project
                </Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.text}
              />
            </View>
          </View>

          {/* Looking for Collaborators Toggle */}
          <View style={styles.toggleSection}>
            <View style={styles.toggleHeader}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Looking for Collaborators</Text>
                <Text style={styles.toggleDescription}>
                  Let others know you're open to collaboration
                </Text>
              </View>
              <Switch
                value={lookingForCollaborators}
                onValueChange={setLookingForCollaborators}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.text}
              />
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color={Colors.info} />
            <Text style={styles.infoText}>
              You can upload audio files, invite collaborators, and adjust all settings after creating your project.
            </Text>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, creating && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={creating}
          >
            <Text style={styles.createButtonText}>
              {creating ? 'Creating...' : 'Create Project'}
            </Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body,
    color: Colors.text,
  },
  textArea: {
    height: 120,
    paddingTop: Spacing.md,
  },
  rowGroup: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  toggleSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  toggleLabel: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  toggleDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${Colors.info}20`,
    borderWidth: 1,
    borderColor: Colors.info,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.body,
    color: Colors.text,
    flex: 1,
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },
})