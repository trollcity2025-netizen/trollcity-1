[{
	"resource": "/e:/troll/trollcity-1/supabase/functions/send-push-notification/index.ts",
	"owner": "typescript",
	"code": "2307",
	"severity": 8,
	"message": "Cannot find module 'https://esm.sh/@supabase/supabase-js@2.39.3' or its corresponding type declarations.",
	"source": "ts",
	"startLineNumber": 2,
	"startColumn": 30,
	"endLineNumber": 2,
	"endColumn": 75,
	"origin": "extHost1",
	"extensionID": "vscode.typescript-language-features"
},{
	"resource": "/e:/troll/trollcity-1/supabase/functions/send-push-notification/index.ts",
	"owner": "typescript",
	"code": "5097",
	"severity": 8,
	"message": "An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.",
	"source": "ts",
	"startLineNumber": 4,
	"startColumn": 29,
	"endLineNumber": 4,
	"endColumn": 49,
	"origin": "extHost1",
	"extensionID": "vscode.typescript-language-features"
}]
import { supabase } from "./supabase";
import { NotificationType } from "../types/notifications";

export type { NotificationType };

export async function sendNotification(
  userId: string | null,
  type: NotificationType,
  title: string,
  message: string,
  metadata: Record<string, any> = {}
) {
  const { error } = await supabase.from("notifications").insert([
    {
      user_id: userId ?? null,
      type,
      title,
      message,
      metadata,
      read: false,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error("Notification Error:", error);
    throw error;
  }

  // Send push notification via Edge Function
  if (userId) {
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: userId,
          title,
          body: message,
          // Construct URL based on type/metadata if needed
          // For now, default handling in service worker or simple open
        }
      });
    } catch (pushErr) {
      console.warn('Failed to send push notification:', pushErr);
      // Non-blocking error
    }
  }
}
