import React, { useState } from 'react';

import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';

import { Picker } from '@react-native-picker/picker';

import * as ImagePicker from 'expo-image-picker';

import * as Location from 'expo-location';

import { useApp } from '../../contexts/AppContext';

import { BUSINESS_CATEGORIES } from '../../constants/categories';

import { supabase } from '../../config/database';

import { useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';


// --- SUPABASE CONFIGURATION ---

const BUSINESS_BUCKET = 'business-uploads';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

// ------------------------------


// Array of 7 nulls to manage 7 distinct images
const INITIAL_IMAGES_STATE = Array(7).fill(null);


export default function AddBusinessScreen() {

  const { session, isPremium, isLoadingSession } = useApp();

  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    ownerName: '',
    phone: '',
    description: '',
    referenceId: '',
    address: '',
    latitude: '',
    longitude: '',
    location: null,
    images: INITIAL_IMAGES_STATE,
    video: null,
    workingHours: '',
    supportsHomeDelivery: 'No'
  });

  const [locating, setLocating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);


  if (isLoadingSession) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#F97316" />
        <Text style={styles.loadingText}>Verifying subscription status...</Text>
      </View>
    );
  }


  // Helper function to decode URI to ArrayBuffer
  const uriToBuffer = async (uri) => {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch URI: ${response.status}`);
    }
    return await response.arrayBuffer();
  };


  const pickLocation = async () => {
    setLocating(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        setLocating(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const { latitude, longitude } = location.coords;
      let addressObj = await Location.reverseGeocodeAsync({ latitude, longitude });

      let addressStr =
        addressObj && addressObj.length > 0
          ? `${addressObj[0].name || ''}, ${addressObj[0].street || ''}, ${addressObj[0].city || ''}, ${addressObj[0].region || ''}, ${addressObj[0].postalCode || ''}`
          : '';

      setFormData({
        ...formData,
        location: { latitude, longitude, address: addressStr },
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        address: addressStr
      });

    } catch {
      Alert.alert('Error', 'Failed to get location.');
    }
    setLocating(false);
  };


  const pickImageForIndex = async (index) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      const newImages = [...formData.images];
      newImages[index] = result.assets[0].uri;
      setFormData({ ...formData, images: newImages });
    }
  };


  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });

    if (!result.canceled && result.assets[0].uri) {
      setFormData({ ...formData, video: result.assets[0].uri });
    }
  };


  const handleSubmit = async () => {

    // New code - Allows proceeding even if session is missing
    const userIdentifier = session?.user?.id || 'anonymous_user';
    // if (!session?.user) {
    //   Alert.alert('Authentication Error', 'You must be logged in.');
    //   return;
    // }


    if (!formData.name || !formData.category) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (!formData.images.some(uri => uri !== null)) {
      Alert.alert('Missing Image', 'Upload at least one image.');
      return;
    }

    setIsUploading(true);
    Alert.alert("Uploading", "Please wait...");

    try {

      // const ownerId = session.user.id;

      // const uploadFile = async (uri, type, index) => {
      //   const buffer = await uriToBuffer(uri);
      //   const fileExtension = uri.split('.').pop();
      //   const path = `${ownerId}/${type}_${index}.${fileExtension}`;
      //   const mimeType = `${type}/${fileExtension}`;

      // New code - Uses a safe identifier and adds a timestamp to prevent overwriting

      const ownerId = session?.user?.id || 'public_upload';

      // const uploadFile = async (uri, type, index) => {
      //   const buffer = await uriToBuffer(uri);
      //   const fileExtension = uri.split('.').pop();
      //   // Adding Date.now() ensures that even if ownerId is the same, files don't overwrite
      //   // --- DEFINE THE MIME TYPE PROPERLY ---
      //   const mime = type === 'video' ? `video/${fileExtension}` : `image/${fileExtension}`;
      //   const path = `${ownerId}/${Date.now()}_${type}_${index}.${fileExtension}`;


      //   const { error } = await supabase.storage
      //     .from(BUSINESS_BUCKET)
      //     .upload(path, buffer, {
      //       contentType: mime,
      //       upsert: true,
      //     });

      //   if (error) throw error;

      //   const { data } = supabase.storage.from(BUSINESS_BUCKET).getPublicUrl(path);
      //   return data.publicUrl;
      // };

      const uploadFile = async (uri, type, index) => {
        const buffer = await uriToBuffer(uri);
        const fileExtension = uri.split('.').pop().toLowerCase();

        // Use 'anonymous' as a folder name if session is missing
        const folderName = session?.user?.id || 'anonymous';
        const path = `${folderName}/${Date.now()}_${type}_${index}.${fileExtension}`;
        const mime = type === 'video' ? `video/${fileExtension}` : `image/${fileExtension}`;

        const { error } = await supabase.storage
          .from(BUSINESS_BUCKET)
          .upload(path, buffer, {
            contentType: mime,
            cacheControl: '3600',
            upsert: true,
          });

        if (error) throw error;

        const { data } = supabase.storage.from(BUSINESS_BUCKET).getPublicUrl(path);
        return data.publicUrl;
      };


      const uploadedImageUrls = [];

      for (let i = 0; i < formData.images.length; i++) {
        if (formData.images[i]) {
          const url = await uploadFile(formData.images[i], 'image', i + 1);
          uploadedImageUrls.push(url);
        }
      }

      let videoUrl = null;
      if (formData.video) {
        videoUrl = await uploadFile(formData.video, 'video', 'main');
      }

      // const { error } = await supabase.rpc('insert_business_data', {
      //   p_owner_id: ownerId,
      //   p_name: formData.name,
      //   p_category: formData.category,
      //   p_owner_name: formData.ownerName,
      //   p_phone: formData.phone,
      //   p_description: formData.description,
      //   p_reference_id: formData.referenceId,
      //   p_address: formData.address,
      //   p_latitude: parseFloat(formData.latitude),
      //   p_longitude: parseFloat(formData.longitude),
      //   p_working_hours: formData.workingHours,
      //   p_supports_home_delivery: formData.supportsHomeDelivery === 'Yes',
      //   p_image_urls: uploadedImageUrls,
      //   p_video_url: videoUrl,
      // });

      const { error } = await supabase.rpc('insert_business_data', {
        p_name: formData.name,
        p_category: formData.category,
        p_owner_name: formData.ownerName,
        p_phone: formData.phone,
        p_description: formData.description,
        p_reference_id: formData.referenceId,
        p_address: formData.address,
        p_latitude: parseFloat(formData.latitude),
        p_longitude: parseFloat(formData.longitude),
        p_working_hours: formData.workingHours,
        p_supports_home_delivery: formData.supportsHomeDelivery === 'Yes',
        p_image_urls: uploadedImageUrls,
        p_video_url: videoUrl, // This can be null
        p_owner_id: session?.user?.id || '00000000-0000-0000-0000-000000000000', // This can now be null safely
      });

      if (error) throw error;

      Alert.alert("Success", "Business Published successfully!");

      setFormData({
        name: '',
        category: '',
        ownerName: '',
        phone: '',
        description: '',
        referenceId: '',
        address: '',
        latitude: '',
        longitude: '',
        location: null,
        images: INITIAL_IMAGES_STATE,
        video: null,
        workingHours: '',
        supportsHomeDelivery: 'No'
      });

    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <ScrollView style={styles.container}>



      <View style={styles.header}>



        <Text style={styles.title}>Add Your Business</Text>



      </View>







      <View style={styles.form}>



        <TextInput style={styles.input} placeholder="Business Name *" value={formData.name} onChangeText={(text) => setFormData({ ...formData, name: text })} />



        <TextInput style={styles.input} placeholder="Owner Name *" value={formData.ownerName} onChangeText={(text) => setFormData({ ...formData, ownerName: text })} />



        <TextInput style={styles.input} placeholder="Phone Number *" value={formData.phone} onChangeText={(text) => setFormData({ ...formData, phone: text })} keyboardType="phone-pad" />







        {/* NEW FIELD: Working Hours */}



        <TextInput



          style={[styles.input, styles.textArea]}



          placeholder="Working Hours (e.g., Mon-Fri: 9am-6pm, Sat: 10am-2pm)"



          value={formData.workingHours}



          onChangeText={(text) => setFormData({ ...formData, workingHours: text })}



          multiline



          numberOfLines={2}



        />



        {/* --------------------------- */}







        <View style={styles.pickerContainer}>



          <Picker selectedValue={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>



            <Picker.Item label="Select Business Category *" value="" />



            {BUSINESS_CATEGORIES.map(cat => <Picker.Item key={cat} label={cat} value={cat} />)}



          </Picker>



        </View>







        {/*  NEW FIELD: Home Delivery Dropdown */}



        <Text style={styles.sectionHeader}>Does your business support Home Delivery?</Text>



        <View style={styles.pickerContainer}>



          <Picker



            selectedValue={formData.supportsHomeDelivery}



            onValueChange={(value) => setFormData({ ...formData, supportsHomeDelivery: value })}



          >


            <Picker.Item label="No" value="No" />



            <Picker.Item label="Yes" value="Yes" />



          </Picker>



        </View>



        {/* ----------------------------------- */}


        <TextInput style={[styles.input, styles.textArea]} placeholder="Business Description" value={formData.description} onChangeText={(text) => setFormData({ ...formData, description: text })} multiline numberOfLines={4} />



        <TextInput style={styles.input} placeholder="Sales Executive Reference ID" value={formData.referenceId} onChangeText={(text) => setFormData({ ...formData, referenceId: text })} />


        <Text style={{ color: '#ff0000ff' }}>*Please make sure you are physically present inside your business building for precise location before selecting the current location below. Your current location will be marked as your accurate business location.</Text>



        <Text></Text>



        {/* Location Picker */}



        <TouchableOpacity style={styles.locationButton} onPress={pickLocation} disabled={locating || isUploading}>



          <Text style={styles.locationText}>{locating ? 'Detecting Location...' : 'Select Current Location as Business Location'}</Text>



        </TouchableOpacity>



        {formData.address ? (



          <View style={styles.locationInfo}>



            <Text style={styles.locationLabel}>Address:</Text>



            <Text style={styles.locationValue}>{formData.address}</Text>



            <Text style={styles.locationLabel}>Latitude:</Text>



            <Text style={styles.locationValue}>{formData.latitude}</Text>



            <Text style={styles.locationLabel}>Longitude:</Text>



            <Text style={styles.locationValue}>{formData.longitude}</Text>



          </View>



        ) : null}







        {/* --- 7 Image Upload Buttons --- */}



        <Text style={styles.sectionHeader}>Upload you Business Images below</Text>



        <View style={styles.imageGrid}>



          {formData.images.map((imageUri, index) => (



            <View key={index} style={styles.imageContainer}>



              <TouchableOpacity



                style={[styles.uploadButtonSmall, imageUri && styles.uploadedButton]}



                onPress={() => pickImageForIndex(index)}



                disabled={isUploading}



              >



                <Text style={imageUri ? styles.uploadedText : styles.uploadText}>



                  {imageUri ? `Image ${index + 1} Selected` : `Img ${index + 1}`}



                </Text>



              </TouchableOpacity>



              {imageUri && <Image source={{ uri: imageUri }} style={styles.imagePreview} />}



            </View>



          ))}



        </View>



        {/* ------------------------------ */}







        {/* Video Upload Button */}



        <Text style={styles.sectionHeader}>Business Video (Optional)</Text>



        <TouchableOpacity style={styles.uploadButton} onPress={pickVideo} disabled={isUploading}>



          <Text style={styles.uploadText}>{formData.video ? 'Video Selected' : 'Upload 1 Video'}</Text>



        </TouchableOpacity>







        <Text style={{ color: '#ff0000ff', fontWeight: 'bold', marginTop: 15 }}>Note: All submitted information, including documents and text, cannot be edited later. Please verify everything before submitting.</Text>







        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isUploading}>



          {isUploading ? (



            <ActivityIndicator color="#fff" />



          ) : (



            <Text style={styles.submitText}>Publish Business</Text>



          )}



        </TouchableOpacity>



        <Text style={{ marginTop: 3 }}>*Terms and Conditions Apply</Text>











        <Text></Text>



      </View>



    </ScrollView>



  );



}







const styles = StyleSheet.create({



  container: { flex: 1, backgroundColor: '#F3F4F6' },



  header: { backgroundColor: '#ff8c21', padding: 20, paddingTop: 50 },



  title: { fontSize: 28, fontWeight: 'bold', color: '#000000ff' },



  form: { padding: 16 },



  input: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#E5E7EB' },



  textArea: { height: 100, textAlignVertical: 'top' },



  pickerContainer: { backgroundColor: '#fff', borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },







  // Upload Styles



  uploadButton: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 12, borderWidth: 2, borderColor: '#2563EB', borderStyle: 'dashed' },



  uploadText: { color: '#2563EB', fontSize: 16, textAlign: 'center', fontWeight: '600' },







  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 10, color: '#333' },







  // Grid Styles for 7 images



  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },



  imageContainer: { width: '32%', marginBottom: 10, alignItems: 'center' }, // 3 items per row



  uploadButtonSmall: { backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#2563EB', borderStyle: 'dashed', width: '100%', minHeight: 40, justifyContent: 'center' },



  uploadedButton: { borderColor: '#10B981', borderStyle: 'solid' },



  uploadedText: { color: '#10B981', fontSize: 12, textAlign: 'center', fontWeight: '600' },



  imagePreview: { width: '100%', height: 60, borderRadius: 5, marginTop: 5, borderWidth: 1, borderColor: '#ccc' },







  submitButton: { backgroundColor: '#F97316', borderRadius: 10, padding: 16, marginTop: 8 },



  submitText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },



  locationButton: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 12, borderWidth: 2, borderColor: '#22C55E', borderStyle: 'dashed' },



  locationText: { color: '#22C55E', fontSize: 16, textAlign: 'center', fontWeight: '600' },



  locationInfo: { backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#22C55E' },



  locationLabel: { fontWeight: 'bold', color: '#2563EB', fontSize: 14 },



  locationValue: { color: '#334155', fontSize: 14, marginBottom: 4 },







  // 🚨 NEW STYLES FOR ACCESS DENIED MESSAGE



  centerContainer: {



    flex: 1,



    justifyContent: 'center',



    alignItems: 'center',



    padding: 30,



    backgroundColor: '#F3F4F6',



  },



  loadingText: {



    marginTop: 10,



    fontSize: 16,



    color: '#F97316',



  },



  accessDeniedTitle: {



    fontSize: 22,



    fontWeight: 'bold',



    color: '#EF4444',



    marginTop: 15,



    marginBottom: 10,



  },



  accessDeniedText: {



    fontSize: 16,



    textAlign: 'center',



    color: '#4B5563',



    lineHeight: 24,



    marginBottom: 20,



  },



  premiumButton: {



    backgroundColor: '#F97316',



    borderRadius: 10,



    paddingHorizontal: 20,



    paddingVertical: 12,



  },



  premiumButtonText: {



    color: '#fff',


    fontSize: 16,



    fontWeight: 'bold',

  }



});
