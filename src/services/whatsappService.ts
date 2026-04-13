import twilio from 'twilio';

export class WhatsappService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    } else {
      console.warn('Twilio credentials missing. WhatsApp service will be mocked mode.');
    }
  }

  async sendMessage(to: string, content: string) {
    // Ensure "to" starts with whatsapp:
    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    
    if (!this.client) {
      console.log(`[MOCK WHATSAPP] To: ${toFormatted} | MSG: ${content}`);
      return { sid: 'mock_sid', status: 'mock' };
    }

    try {
      const message = await this.client.messages.create({
        body: content,
        from: this.fromNumber,
        to: toFormatted,
      });
      console.log(`WhatsApp message sent to ${toFormatted}. SID: ${message.sid}`);
      return message;
    } catch (error) {
      console.error(`Error sending WhatsApp message to ${toFormatted}:`, error);
      throw error;
    }
  }
}

export const whatsappService = new WhatsappService();
