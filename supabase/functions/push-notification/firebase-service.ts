import * as jose from "jose"

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

export class FirebaseService {
  private serviceAccount: ServiceAccount;

  constructor(serviceAccountJson: ServiceAccount) {
    this.serviceAccount = serviceAccountJson;
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: this.serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };
    const jwt = await new jose.SignJWT(claim).setProtectedHeader({ alg: 'RS256' }).sign(await jose.importPKCS8(this.serviceAccount.private_key, 'RS256'));
    
    const params = new URLSearchParams();
    params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    params.append('assertion', jwt);

    const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: params });
    const data = await res.json();
    return data.access_token;
  }

  async send(topic: string, title: string, body: string, dataPayload?: object) {
    const accessToken = await this.getAccessToken();
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.serviceAccount.project_id}/messages:send`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            topic: topic,
            notification: { title, body },
            android: { priority: "high", notification: { channel_id: "stock_alert_channel", click_action: "FLUTTER_NOTIFICATION_CLICK" }, data: dataPayload }
          }
        })
      }
    );
    return await res.json();
  }
}