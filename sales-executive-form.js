import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// ✅ FIXED: use correct FileSystem import (not legacy)
import * as FileSystem from 'expo-file-system';

// ✅ FIXED: required for production build stability
import 'react-native-reanimated';

// ➡️ SUPABASE INTEGRATION
import { supabase } from './supabaseConfig';

// ❌ REMOVED expo-constants (unused + crash-prone in prod)

// ➡️ Buffer polyfill
global.Buffer = global.Buffer || require('buffer').Buffer;

const BUCKET_NAME = 'application-documents';

export default function SalesExecutiveFormScreen() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '', phone: '', email: '', dob: '', aadhar: '', pan: '',
    bankDetails: '', passportPhoto: null, aadharDoc: null, panDoc: null,
    bankDoc: null, signature: null, termsAccepted: false
  });

  const pickDocument = async (field) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8
    });
    if (!result.canceled) {
      setFormData({ ...formData, [field]: result.assets[0].uri });
    }
  };

  const decode = (base64) => {
    return Buffer.from(base64, 'base64');
  };

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.email || !formData.phone || !formData.termsAccepted) {
      Alert.alert('Error', 'Please fill all required fields and accept terms');
      return;
    }

    if (!formData.passportPhoto || !formData.aadharDoc || !formData.panDoc || !formData.bankDoc || !formData.signature) {
      Alert.alert('Error', 'Please upload all required documents.');
      return;
    }

    try {
      const seId = 'SE' + (1611 + Math.floor(Math.random() * 1000));

      const uploadFile = async (uri, field) => {
        if (!uri) return null;

        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });

        const fileExtension = uri.split('.').pop();
        const path = `${seId}/${field}.${fileExtension}`;

        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(path, decode(base64), {
            contentType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
            upsert: true,
          });

        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(path);

        return publicUrlData.publicUrl;
      };

      const [
        passportPhotoURL,
        aadharDocURL,
        panDocURL,
        bankDocURL,
        signatureURL
      ] = await Promise.all([
        uploadFile(formData.passportPhoto, 'passport'),
        uploadFile(formData.aadharDoc, 'aadhar'),
        uploadFile(formData.panDoc, 'pan'),
        uploadFile(formData.bankDoc, 'bank'),
        uploadFile(formData.signature, 'signature')
      ]);

      const submission = {
        se_id: seId,
        full_name: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        dob: formData.dob,
        aadhar: formData.aadhar,
        pan: formData.pan,
        bank_details: formData.bankDetails,
        passport_photo_url: passportPhotoURL,
        aadhar_doc_url: aadharDocURL,
        pan_doc_url: panDocURL,
        bank_doc_url: bankDocURL,
        signature_url: signatureURL,
        terms_accepted: formData.termsAccepted,
        created_at: new Date().toISOString()
      };

      const { error: dbError } = await supabase
        .from('job_applications')
        .insert([submission]);

      if (dbError) throw dbError;

      console.log('Sales Executive data saved with ID:', seId);
      setSubmitted(true);
    } catch (error) {
      console.error('Submission Error:', error);
      Alert.alert('Submission Failed 😔', 'Something went wrong. Please check logs.');
    }
  };

  if (submitted) {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={80} color="#10B981" />
        <Text style={styles.successTitle}>Application Submitted!</Text>
        <Text style={styles.successText}>
          Your form and documents have been sent successfully for review.
        </Text>
        <TouchableOpacity style={styles.dashboardButton} onPress={() => router.back()}>
          <Text style={styles.dashboardText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000000ff" />
        </TouchableOpacity>
        <Text style={styles.title}>Become Sales Executive</Text>
      </View>

      <View style={styles.content}>
        <TextInput style={styles.input} placeholder="Full Name *" value={formData.fullName} onChangeText={(text) => setFormData({ ...formData, fullName: text })} />
        <TextInput style={styles.input} placeholder="Phone Number *" value={formData.phone} onChangeText={(text) => setFormData({ ...formData, phone: text })} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Email *" value={formData.email} onChangeText={(text) => setFormData({ ...formData, email: text })} keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Date of Birth (DD/MM/YYYY) *" value={formData.dob} onChangeText={(text) => setFormData({ ...formData, dob: text })} />
        <TextInput style={styles.input} placeholder="Aadhar Card Number *" value={formData.aadhar} onChangeText={(text) => setFormData({ ...formData, aadhar: text })} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="PAN Card Number *" value={formData.pan} onChangeText={(text) => setFormData({ ...formData, pan: text })} />
        <TextInput style={[styles.input, styles.textArea]} placeholder="Banking Details *" value={formData.bankDetails} onChangeText={(text) => setFormData({ ...formData, bankDetails: text })} multiline numberOfLines={3} />

        <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument('passportPhoto')}>
          <Text style={styles.uploadText}>{formData.passportPhoto ? '✓ Passport Photo' : 'Upload Passport Photo *'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument('aadharDoc')}>
          <Text style={styles.uploadText}>{formData.aadharDoc ? '✓ Aadhar Card' : 'Upload Aadhar Card *'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument('panDoc')}>
          <Text style={styles.uploadText}>{formData.panDoc ? '✓ PAN Card' : 'Upload PAN Card *'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument('bankDoc')}>
          <Text style={styles.uploadText}>{formData.bankDoc ? '✓ Bank Document' : 'Upload Bank Passbook/Cheque *'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument('signature')}>
          <Text style={styles.uploadText}>{formData.signature ? '✓ Signature' : 'Upload Signature *'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkboxContainer} onPress={() => setFormData({ ...formData, termsAccepted: !formData.termsAccepted })}>
          <Ionicons name={formData.termsAccepted ? 'checkbox' : 'square-outline'} size={24} color="#2563EB" />
          <Text style={styles.checkboxText}>I accept the Terms and Conditions *</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitText}>Submit Application</Text>
        </TouchableOpacity>

        <Text></Text><Text></Text><Text></Text><Text></Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: '#ff8c21', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#000000ff' },
  content: { padding: 16 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  textArea: { height: 80, textAlignVertical: 'top' },
  uploadButton: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 12, borderWidth: 2, borderColor: '#2563EB', borderStyle: 'dashed' },
  uploadText: { color: '#2563EB', fontSize: 15 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  checkboxText: { color: '#111827', fontSize: 16 },
  submitButton: { backgroundColor: '#2563EB', padding: 15, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  successTitle: { fontSize: 26, fontWeight: 'bold', marginTop: 20 },
  successText: { fontSize: 16, textAlign: 'center', marginTop: 10, color: '#4B5563' },
  dashboardButton: { marginTop: 25, padding: 15, backgroundColor: '#2563EB', borderRadius: 10 },
  dashboardText: { color: '#fff', fontSize: 16 }
});
