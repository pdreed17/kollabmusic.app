import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import { scale } from '../utils/responsive'
import Header from '../components/Header'

// Collaboration skills options matching profile specialties
const COLLABORATION_SKILLS = [
  { id: 'vocals', label: 'Vocals', icon: 'mic' },
  { id: 'guitar', label: 'Guitar', icon: 'musical-note' },
  { id: 'bass', label: 'Bass', icon: 'albums' },
  { id: 'drums', label: 'Drums', icon: 'musical-notes' },
  { id: 'piano', label: 'Piano/Keys', icon: 'keypad' },
  { id: 'producing', label: 'Producing', icon: 'options' },
  { id: 'mixing', label: 'Mixing', icon: 'options-outline' },
  { id: 'mastering', label: 'Mastering', icon: 'analytics' },
  { id: 'sound-design', label: 'Sound Design', icon: 'color-wand' },
  { id: 'beat-making', label: 'Beat Making', icon: 'pulse' },
  { id: 'lyrics', label: 'Lyrics', icon: 'create' },
  { id: 'composition', label: 'Composition', icon: 'document-text' },
] as const

export default function EditProjectScreen({ route, navigation }: any) {
  const { projectId } = route.params
  const { user, userProfile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [key, setKey] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [status, setStatus] = useState<'active' | 'archived' | 'completed'>('active')
  const [collaborationNeeds, setCollaborationNeeds] = useState<string[]>([])

  useEffect(() => {
    loadProject()
  }, [])

  const loadProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (error) throw error

      setTitle(data.title)
      setDescription(data.description || '')
      setGenre(data.genre || '')
      setBpm(data.bpm?.toString() || '')
      setKey(data.key || '')
      setIsPublic(data.is_public || false)
      setCollaborationNeeds(data.collaboration_needs || [])
      // validate status to match the expected union before updating state
      const allowedStatuses = ['active', 'archived', 'completed'] as const
      const statusValue = allowedStatuses.includes(data.status as any)
        ? (data.status as 'active' | 'archived' | 'completed')
        : 'active'
      setStatus(statusValue)

    } catch (error) {
      console.error('Error loading project:', error)
      Alert.alert('Error', 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a project title')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          genre: genre.trim() || null,
          bpm: bpm ? parseInt(bpm) : null,
          key: key.trim() || null,
          is_public: isPublic,
          collaboration_needs: collaborationNeeds,
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)

      if (error) throw error

      Alert.alert('Success', 'Project updated!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ])

    } catch (error) {
      console.error('Error updating project:', error)
      Alert.alert('Error', 'Failed to update project')
    } finally {
      setSaving(false)
    }
  }

  const handleArchiveToggle = () => {
    if (status === 'active') {
      Alert.alert(
        'Archive Project?',
        'This will hide the project from your active list. You can unarchive it anytime.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Archive', 
            style: 'destructive',
            onPress: () => setStatus('archived')
          }
        ]
      )
    } else {
      setStatus('active')
    }
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Project?',
      'This will permanently delete this project and all its files. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId)

              if (error) throw error

              Alert.alert('Deleted', 'Project deleted successfully', [
                { text: 'OK', onPress: () => navigation.navigate('ProjectsList') }
              ])
            } catch (error) {
              console.error('Error deleting project:', error)
              Alert.alert('Error', 'Failed to delete project')
            }
          }
        }
      ]
    )
  }

  const toggleCollaborationNeed = (skillId: string) => {
    setCollaborationNeeds(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Edit Project"
          variant="compact"
          showBack={true}
          onBack={() => navigation.goBack()}
          showProfile={true}
          onProfilePress={() => navigation.navigate('Profile')}
        profilePhotoUrl={userProfile?.avatar_url}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Edit Project"
        variant="compact"
        showBack={true}
        onBack={() => navigation.goBack()}
        showProfile={true}
        onProfilePress={() => navigation.navigate('Profile')}
        profilePhotoUrl={userProfile?.avatar_url}
      />

      <ScrollView 
        style={styles.content}
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

        {/* Collaboration Needs */}
        <View style={styles.collaborationSection}>
          <Text style={styles.sectionTitle}>Looking for Collaborators</Text>
          <Text style={styles.sectionDescription}>
            Select the skills/roles you need help with. This will be visible to users searching for projects.
          </Text>

          <View style={styles.skillsGrid}>
            {COLLABORATION_SKILLS.map((skill) => {
              const isSelected = collaborationNeeds.includes(skill.id)
              return (
                <TouchableOpacity
                  key={skill.id}
                  style={[
                    styles.skillChip,
                    isSelected && styles.skillChipSelected
                  ]}
                  onPress={() => toggleCollaborationNeed(skill.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={skill.icon as any}
                    size={16}
                    color={isSelected ? Colors.text : Colors.textSecondary}
                  />
                  <Text style={[
                    styles.skillChipText,
                    isSelected && styles.skillChipTextSelected
                  ]}>
                    {skill.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {collaborationNeeds.length > 0 && (
            <View style={styles.selectedCountBadge}>
              <Text style={styles.selectedCountText}>
                {collaborationNeeds.length} skill{collaborationNeeds.length !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}
        </View>

        {/* Archive Status */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Project Status</Text>
          
          <TouchableOpacity
            style={[
              styles.statusCard,
              status === 'active' && styles.statusCardActive
            ]}
            onPress={() => setStatus('active')}
          >
            <Ionicons 
              name="play-circle" 
              size={24} 
              color={status === 'active' ? Colors.primary : Colors.textSecondary} 
            />
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, status === 'active' && styles.statusTitleActive]}>
                Active
              </Text>
              <Text style={styles.statusDescription}>
                Actively working on this project
              </Text>
            </View>
            {status === 'active' && (
              <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusCard,
              status === 'archived' && styles.statusCardActive
            ]}
            onPress={() => setStatus('archived')}
          >
            <Ionicons 
              name="archive" 
              size={24} 
              color={status === 'archived' ? Colors.warning : Colors.textSecondary} 
            />
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, status === 'archived' && styles.statusTitleActive]}>
                Archived
              </Text>
              <Text style={styles.statusDescription}>
                Keep but hide from active list
              </Text>
            </View>
            {status === 'archived' && (
              <Ionicons name="checkmark-circle" size={24} color={Colors.warning} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusCard,
              status === 'completed' && styles.statusCardActive
            ]}
            onPress={() => setStatus('completed')}
          >
            <Ionicons 
              name="checkmark-circle" 
              size={24} 
              color={status === 'completed' ? Colors.success : Colors.textSecondary} 
            />
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, status === 'completed' && styles.statusTitleActive]}>
                Completed
              </Text>
              <Text style={styles.statusDescription}>
                Project is finished
              </Text>
            </View>
            {status === 'completed' && (
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            )}
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>

        {/* Delete Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={20} color={Colors.error} />
          <Text style={styles.deleteButtonText}>Delete Project</Text>
        </TouchableOpacity>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  content: {
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
    height: scale(120),
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
  collaborationSection: {
    marginBottom: Spacing.lg,
  },
  sectionDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
  },
  skillChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  skillChipText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontSize: scale(13),
    fontWeight: '500',
  },
  skillChipTextSelected: {
    color: Colors.text,
    fontWeight: '600',
  },
  selectedCountBadge: {
    backgroundColor: `${Colors.primary}15`,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  selectedCountText: {
    ...Typography.body,
    color: Colors.primary,
    fontSize: scale(13),
    fontWeight: '600',
  },
  statusSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  statusCardActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    ...Typography.bodyLarge,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.xxs,
  },
  statusTitleActive: {
    color: Colors.primary,
  },
  statusDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...Typography.h3,
    color: Colors.text,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: `${Colors.error}20`,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  deleteButtonText: {
    ...Typography.bodyLarge,
    color: Colors.error,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },
})