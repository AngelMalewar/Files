
///////////////////////////////////////////////////////////////////////////////////////////////
import Constants from 'expo-constants';

export const PLANS = {
  REGISTRATION: {
    amount: 99900,
    currency: 'INR',
    name: 'REACH YOU - Registration Fee',
    description: '1 Month Free Access + Premium Features',
    duration: 30
  },
  REGULAR: {
    amount: 15000,
    currency: 'INR',
    name: 'Regular Plan',
    description: 'Monthly subscription'
  },
  PREMIUM: {
    amount: 45000,
    currency: 'INR',
    name: 'Premium Plan',
    description: 'Premium features monthly'
  }
};

export const initiatePayment = async (plan, userDetails, userId, orderId) => {
  try {
    // ✅ Lazy import
    const RazorpayCheckout = require('react-native-razorpay').default;

    const keyId =
      Constants.expoConfig?.extra?.EXPO_PUBLIC_RAZORPAY_ID;

    if (!keyId) {
      throw new Error('Razorpay key missing');
    }

    const options = {
      description: plan.description,
      currency: plan.currency,
      key: keyId,
      amount: plan.amount,
      name: plan.name,
      order_id: orderId,
      prefill: {
        name: userDetails?.name || 'User',
        email: userDetails?.email || 'test@example.com',
        contact: userDetails?.phone || '9999999999',
      },
      theme: { color: '#F97316' },
      notes: { user_id: userId },
    };

    const data = await RazorpayCheckout.open(options);
    return { success: true, ...data };

  } catch (error) {
    console.error('RAZORPAY ERROR:', error);
    throw error;
  }
};
