import { whatsappService } from '../services/whatsappService';
import { prisma } from '../services/db';
import { sheetsService } from '../services/sheetsService';
import { voiceService } from '../services/voiceService';

export async function handleNewLead(data: { name: string; phone: string; email?: string; source?: string }) {
  if (!data.name || !data.phone) {
    throw new Error('Name and phone are required');
  }

  // Format phone to E.164 if needed, in a real app you'd use Google libphonenumber
  const formattedPhone = data.phone.startsWith('+') ? data.phone : `+${data.phone}`;

  // 1. Create or find lead in DB
  let lead = await prisma.lead.findUnique({ where: { phone: formattedPhone } });
  
  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone: formattedPhone,
        email: data.email,
        source: data.source || 'Manual',
      }
    });

    // 2. Append to Google Sheets
    await sheetsService.appendLeadRow([
      lead.name, 
      lead.phone, 
      lead.email || '', 
      lead.source, 
      lead.callStatus, 
      '', // Notes 
      lead.followUpStage.toString(), 
      new Date().toISOString(), 
      '', // nextFollowUpDate
      lead.leadStatus
    ]);
  } else {
    // If lead exists, maybe they submitted another form. Just log it or skip.
    console.log(`Lead ${formattedPhone} already exists. Skipping creation.`);
    return lead;
  }

  // 3. Initiate Instant Call
  try {
    await voiceService.initiateCall(lead.phone, lead.name, lead.id);
    await whatsappService.sendMessage({
  phone: lead.phone,
  name: lead.name
});
    // Note: the webhook from Vapi will handle the outcome of the call.
  } catch (err) {
    console.error('Failed to initiate call for new lead', err);
    // Set fallback follow-up if call fails to even trigger
    const nextDate = new Date();
    nextDate.setMinutes(nextDate.getMinutes() + 10);
    await prisma.lead.update({
      where: { id: lead.id },
      data: { 
        callStatus: 'Failed_Trigger', 
        nextFollowUpDate: nextDate 
      }
    });
  }

  return lead;
}
