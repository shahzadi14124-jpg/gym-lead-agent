import { google } from 'googleapis';
import path from 'path';

export class SheetsService {
  private sheets;
  private spreadsheetId: string;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEET_ID || '';
    
    let auth;
    try {
      auth = new google.auth.GoogleAuth({
        keyFile: path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      this.sheets = google.sheets({ version: 'v4', auth });
    } catch (error) {
      console.warn('Google Sheets authentication failed or credentials not provided. Sheets sync will be skipped in this run.');
    }
  }

  async appendLeadRow(leadData: any[]) {
    if (!this.sheets) return;
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'A:A', // Appends to the first sheet regardless of its name
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [leadData], // Array of arrays: [[Name, Phone, Email, Source, Call Status, Notes from Call, Follow-Up Stage, Last Contacted, Next Follow-Up Date, Lead Status]]
        },
      });
      console.log('Lead row appended to Google Sheet.');
    } catch (error) {
      console.error('Error appending row to Google Sheets:', error);
    }
  }

  // Update specific row if needed based on phone number or ID index
  // Simplified for now, just appending or keeping track.
  // Real implementation might need to map DB IDs to row numbers.
}

export const sheetsService = new SheetsService();
