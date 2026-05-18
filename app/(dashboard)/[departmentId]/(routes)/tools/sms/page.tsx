import { redirect } from "next/navigation";

import { ToolsLayout } from "@/components/layouts/tools-layout";
import SmsTool from "@/components/admin/sms/sms-tool";
import { requireSmsAdmin } from "@/lib/auth/require-sms-admin";
import { getDefaultUniSmsSenderId } from "@/lib/sms/unisms";

export default async function SmsToolPage({
  params,
}: {
  params: { departmentId: string };
}) {
  try {
    await requireSmsAdmin(params.departmentId);
  } catch {
    redirect(`/${params.departmentId}/tools`);
  }

  return (
    <ToolsLayout
      params={params}
      title="Text Blast"
      description="Send Twilio SMS messages, review logs, and manage replies."
      breadcrumbs={[{ label: "Text Blast" }]}
      contentClassName="space-y-6"
    >
      <SmsTool
        departmentId={params.departmentId}
        defaultSenderId={getDefaultUniSmsSenderId()}
      />
    </ToolsLayout>
  );
}
