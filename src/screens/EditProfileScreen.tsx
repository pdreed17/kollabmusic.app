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
  ActivityIndicator,
  Image,
  Switch,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme'
import Header from '../components/Header'

const SPECIALTIES = [
  // Instruments
  { value: 'vocals', label: 'Vocals', category: 'Instruments', icon: 'mic' },
  { value: 'guitar', label: 'Guitar', category: 'Instruments', icon: 'musical-note' },
  { value: 'bass', label: 'Bass', category: 'Instruments', icon: 'albums' },
  { value: 'piano', label: 'Piano', category: 'Instruments', icon: 'keypad' },
  { value: 'keys', label: 'Keys', category: 'Instruments', icon: 'keypad' },
  { value: 'drums', label: 'Drums', category: 'Instruments', icon: 'musical-notes' },
  { value: 'percussion', label: 'Percussion', category: 'Instruments', icon: 'hand-right' },
  { value: 'strings', label: 'Strings', category: 'Instruments', icon: 'musical-note' },
  { value: 'brass', label: 'Brass', category: 'Instruments', icon: 'musical-note' },
  { value: 'woodwinds', label: 'Woodwinds', category: 'Instruments', icon: 'musical-note' },
  
  // Production
  { value: 'producing', label: 'Producing', category: 'Production', icon: 'options' },
  { value: 'mixing', label: 'Mixing', category: 'Production', icon: 'options-outline' },
  { value: 'mastering', label: 'Mastering', category: 'Production', icon: 'analytics' },
  { value: 'sound-design', label: 'Sound Design', category: 'Production', icon: 'color-wand' },
  { value: 'beat-making', label: 'Beat Making', category: 'Production', icon: 'pulse' },
  
  // Songwriting
  { value: 'lyrics', label: 'Lyrics', category: 'Songwriting', icon: 'create' },
  { value: 'melody', label: 'Melody', category: 'Songwriting', icon: 'musical-notes' },
  { value: 'composition', label: 'Composition', category: 'Songwriting', icon: 'document-text' },
  { value: 'arrangement', label: 'Arrangement', category: 'Songwriting', icon: 'git-branch' },
  
  // Other
  { value: 'dj', label: 'DJ', category: 'Other', icon: 'disc' },
  { value: 'live-performance', label: 'Live Performance', category: 'Other', icon: 'microphone' },
  { value: 'engineering', label: 'Engineering', category: 'Other', icon: 'settings' },
  { value: 'other', label: 'Other', category: 'Other', icon: 'ellipsis-horizontal' },
]

const CATEGORIES = ['Instruments', 'Production', 'Songwriting', 'Other']

export default function EditProfileScreen({ navigation }: any) {
  const { user, userProfile } = useAuth()
  const [displayName, setDisplayName] = useState(userProfile?.display_name || '')
  const [bio, setBio] = useState(userProfile?.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatar_url || '')
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(userProfile?.specialties || [])
  const [openToKollab, setOpenToKollab] = useState(userProfile?.open_to_kollab ?? true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })
      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Error picking image:', error)
    }
  }

  const uploadImage = async (uri: string) => {
    try {
      setUploading(true)

      const fileExt = uri.split('.').pop() || 'jpg'
      const fileName = `${user?.id}_${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Convert file URI to ArrayBuffer for upload
      const response = await fetch(uri)
      const arrayBuffer = await response.arrayBuffer()

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('profile-pictures').getPublicUrl(filePath)
      setAvatarUrl(data.publicUrl)
      Alert.alert('Success', 'Profile picture uploaded!')
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const toggleSpecialty = (value: string) => {
    setSelectedSpecialties(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    )
  }

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a display name')
      return
    }
    const userId = user?.id
    if (!userId) {
      Alert.alert('Error', 'You must be signed in to update your profile')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl || null,
          specialties: selectedSpecialties,
          open_to_kollab: openToKollab,
        })
        .eq('id', userId)
      
      if (error) throw error
      
      Alert.alert('Success', 'Profile updated!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ])
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Edit Profile" variant="compact" showBack={true} onBack={() => navigation.goBack()} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Picture */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Picture</Text>
          <View style={styles.avatarSection}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(displayName || 'U').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.changePhotoButton} onPress={pickImage} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="camera" size={20} color={Colors.primary} />
                  <Text style={styles.changePhotoText}>{avatarUrl ? 'Change Photo' : 'Add Photo'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Display Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Your Name"
              placeholderTextColor={Colors.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell others about yourself..."
              placeholderTextColor={Colors.textSecondary}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Open to Kollab */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Open to Kollab</Text>
              <Text style={styles.toggleDescription}>
                Let others know you're available for collaborations
              </Text>
            </View>
            <Switch
              value={openToKollab}
              onValueChange={setOpenToKollab}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </View>
        </View>

        {/* Specialties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <Text style={styles.sectionSubtitle}>Select all that apply - these will be visible to others</Text>
          {CATEGORIES.map((category) => (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category}</Text>
              <View style={styles.specialtiesGrid}>
                {SPECIALTIES.filter(s => s.category === category).map((specialty) => {
                  const isSelected = selectedSpecialties.includes(specialty.value)
                  return (
                    <TouchableOpacity
                      key={specialty.value}
                      style={[styles.specialtyChip, isSelected && styles.specialtyChipSelected]}
                      onPress={() => toggleSpecialty(specialty.value)}
                    >
                      <Ionicons name={specialty.icon as any} size={16} color={isSelected ? Colors.text : Colors.textSecondary} />
                      <Text style={[styles.specialtyChipText, isSelected && styles.specialtyChipTextSelected]}>
                        {specialty.label}
                      </Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={16} color={Colors.text} />}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          ))}
        </View>

        {/* Save Button */}
        <View style={styles.section}>
          <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.text} size="small" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundDark },
  content: { flex: 1 },
  section: { padding: Spacing.lg, backgroundColor: Colors.surface, marginTop: Spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.xs },
  sectionSubtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.md },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  avatarImage: { width: 100, height: 100, borderRadius: 50, marginBottom: Spacing.md, borderWidth: 2, borderColor: Colors.border },
  avatarText: { fontSize: 40, color: Colors.text, fontWeight: '600' },
  changePhotoButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border },
  changePhotoText: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
  formGroup: { marginBottom: Spacing.md },
  label: { ...Typography.bodyLarge, color: Colors.text, fontWeight: '600', marginBottom: Spacing.xs },
  input: { ...Typography.body, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.text },
  textArea: { height: 100, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleInfo: { flex: 1, marginRight: Spacing.md },
  toggleLabel: { ...Typography.bodyLarge, color: Colors.text, fontWeight: '600', marginBottom: Spacing.xxs },
  toggleDescription: { ...Typography.body, color: Colors.textSecondary },
  categorySection: { marginBottom: Spacing.lg },
  categoryTitle: { ...Typography.bodyLarge, color: Colors.textSecondary, fontWeight: '600', marginBottom: Spacing.sm, textTransform: 'uppercase', fontSize: 12 },
  specialtiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  specialtyChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.surfaceElevated, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  specialtyChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  specialtyChipText: { ...Typography.body, color: Colors.textSecondary, fontWeight: '600' },
  specialtyChipTextSelected: { color: Colors.text },
  saveButton: { backgroundColor: Colors.primary, padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { ...Typography.bodyLarge, color: Colors.text, fontWeight: '600' },
  bottomSpacer: { height: Spacing.xxxl },
})