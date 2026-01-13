
import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { initiatePayment, PLANS } from '../../utils/razorpay';
import { useApp } from '../../contexts/AppContext';

// 🚨 Define the URL for your Netlify Order Creation function
const ORDER_CREATION_URL = 'https://xyzsample.com/create-order';

// 🆕 NEW: BouncingText Component (For "Limited Offer!")
const BouncingText = ({ text, style }) => {
  const bounceValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    bounceValue.setValue(0);
    Animated.loop(
      Animated.timing(bounceValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.bezier(0.68, -0.55, 0.27, 1.55),
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateY = bounceValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -10, 0],
  });

  return (
    <Animated.Text style={[style, { transform: [{ translateY }] }]}>
      {text}
    </Animated.Text>
  );
};

// 🆕 NEW: PoundingPrice Component
const PoundingPrice = ({ currencyStyle, priceStyle, priceValue }) => {
  const animationValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const beat = Animated.sequence([
      Animated.timing(animationValue, {
        toValue: 1,
        duration: 150,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(animationValue, {
        toValue: 0,
        duration: 150,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.delay(500),
    ]);

    Animated.loop(beat).start();
  }, [animationValue]);

  const scale = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const translateY = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });

  return (
    <Animated.View style={[styles.priceRow, { transform: [{ scale }, { translateY }] }]}>
      <Text style={currencyStyle}>₹</Text>
      <Text style={priceStyle}>{priceValue}</Text>
    </Animated.View>
  );
};

export default function GoProScreen() {
  const { user, setUser } = useApp();

  const handleSubscribe = async () => {
    const currentUserId = user?.id;

    if (!currentUserId) {
      Alert.alert('Error', 'Could not find user ID. Please log in again.');
      return;
    }

    try {
      const orderCreationResponse = await fetch(ORDER_CREATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: PLANS.REGISTRATION.amount,
          currency: PLANS.REGISTRATION.currency,
          userId: currentUserId,
        }),
      });

      const orderData = await orderCreationResponse.json();

      if (!orderCreationResponse.ok || !orderData.orderId) {
        throw new Error(orderData.error || 'Failed to initialize payment order.');
      }

      const result = await initiatePayment(
        PLANS.REGISTRATION,
        user,
        currentUserId,
        orderData.orderId
      );

      if (result.success) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        setUser({
          ...user,
          planType: 'paid',
          planExpiry: expiryDate.toISOString(),
        });

        Alert.alert('Success', 'Payment successful! Your premium access has been activated.');
      }
    } catch (error) {
      Alert.alert(
        'Error',
        `Payment failed: ${error.message || 'Please check your network and try again.'}`
      );
    }
  };

  const features = [
    'Your business, your rules.',
    'Add your business to the platform',
    'Publish up to 5 advertisements',
    'Post daily updates about your business',
    'Reach wider audience in your area',
    'Get featured in nearby searches',
    'Access to analytics dashboard',
    'Share your business profile across social media',
    'Hyperlocal customer targeting',
    'Direct call button for customers',
    'Direct location map for easy navigation',
    'Showcase your business and products with images and videos.',
    'Let people know if you are available for home delivery or takeaway.',
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Go Premium</Text>
        <Text style={styles.subtitle}>Unlock all features and grow your business</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.priceCard}>
          <Text style={styles.planName}>Premium Registration</Text>

          <View style={styles.originalPriceContainer}>
            <Text style={styles.strikethroughText}>₹5999</Text>
          </View>

          <PoundingPrice
            currencyStyle={styles.currency}
            priceStyle={styles.price}
            priceValue="999"
          />

          <Text style={styles.offer}>Get 2 months FREE access!</Text>

          <View style={styles.limitedOfferContainer}>
            <BouncingText text="Limited Offer!" style={styles.limitedOfferText} />
          </View>
        </View>

        <TouchableOpacity style={styles.subscribeButton} onPress={handleSubscribe}>
          <Text style={styles.subscribeText}>Subscribe Now</Text>
        </TouchableOpacity>

        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Premium Features</Text>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  header: { backgroundColor: '#ff8c21', padding: 20, paddingTop: 50 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#000' },
  subtitle: { fontSize: 14, color: '#000', marginTop: 4, opacity: 0.8 },
  content: { padding: 16 },
  priceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    elevation: 4,
  },
  planName: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  originalPriceContainer: { marginBottom: 4 },
  strikethroughText: {
    fontSize: 30,
    color: '#ff0000',
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  currency: { fontSize: 28, fontWeight: 'bold', color: '#0a6a01', marginTop: 8 },
  price: { fontSize: 70, fontWeight: 'bold', color: '#0a6a01' },
  offer: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '700',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  limitedOfferContainer: { marginTop: 15, marginBottom: 8 },
  limitedOfferText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ff2600',
    textTransform: 'uppercase',
  },
  featuresSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  featuresTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureText: { fontSize: 15, color: '#4B5563', flex: 1 },
  subscribeButton: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  subscribeText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
