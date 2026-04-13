export class VoiceService {
  private apiKey: string;
  private assistantId: string;
  private phoneNumberId: string;
  private baseUrl = 'https://api.vapi.ai';

  constructor() {
    this.apiKey = process.env.VAPI_API_KEY || '';
    this.assistantId = process.env.VAPI_ASSISTANT_ID || '';
    this.phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID || '';
  }

  async initiateCall(phoneNumber: string, leadName: string, leadId: number) {
    if (!this.apiKey) {
      console.warn('Vapi API key missing. Skipping actual call out.');
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/call`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumberId: this.phoneNumberId,
          customer: {
            number: phoneNumber,
            name: leadName,
          },
          assistantId: this.assistantId,
          // We can pass metadata so the webhook knows which lead this was
          metadata: {
            leadId: leadId
          }
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to start call');
      }

      console.log(`Call initiated to ${phoneNumber} (Lead ID: ${leadId}). Vapi Call ID: ${data.id}`);
      return data;
    } catch (error) {
      console.error('Error initiating Vapi call:', error);
      throw error;
    }
  }
}

export const voiceService = new VoiceService();
