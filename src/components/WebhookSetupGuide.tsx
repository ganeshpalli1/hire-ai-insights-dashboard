import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface WebhookSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WebhookSetupGuide: React.FC<WebhookSetupGuideProps> = ({ isOpen, onClose }) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Get the backend URL
  const backendUrl = 'https://backendb2b.azurewebsites.net'; // Hardcoded backend URL
  const fullWebhookUrl = `${backendUrl}/api/convai-webhook`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ElevenLabs Webhook Setup Guide</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Why is this needed?</h3>
            <p className="text-sm text-blue-800">
              The webhook enables automatic interview analysis after completion. Without it, 
              you'll need to manually trigger analysis for each interview.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Step 1: Access ElevenLabs Dashboard</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Log in to your ElevenLabs account</li>
              <li>Navigate to the <strong>Conversational AI</strong> section</li>
              <li>Go to <strong>Settings</strong> → <strong>Webhooks</strong></li>
            </ol>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Step 2: Create a New Webhook</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webhook Name
                </label>
                <code className="block p-2 bg-white rounded border border-gray-300 text-sm">
                  Interview Analysis Webhook
                </code>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Callback URL
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-white rounded border border-gray-300 text-sm break-all">
                    {fullWebhookUrl}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(fullWebhookUrl)}
                    variant="outline"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Auth Method
                </label>
                <code className="block p-2 bg-white rounded border border-gray-300 text-sm">
                  HMAC
                </code>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Step 3: Save the Webhook Secret</h3>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> After creating the webhook, ElevenLabs will show you a 
                secret key. Copy this key and add it to your backend's <code>.env</code> file:
              </p>
              <code className="block mt-2 p-2 bg-white rounded border border-yellow-300 text-sm">
                ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret_here
              </code>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Step 4: Test the Webhook</h3>
            <p className="text-sm text-gray-600">
              After setup, complete a test interview. You should see the analysis automatically 
              process within a few seconds of ending the interview.
            </p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2">✅ Setup Complete!</h4>
            <p className="text-sm text-green-800">
              Once configured, all interviews will be automatically analyzed upon completion.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={onClose}>Close</Button>
            <Button
              variant="outline"
              onClick={() => window.open('https://elevenlabs.io/app/conversational-ai', '_blank')}
            >
              Open ElevenLabs Dashboard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 