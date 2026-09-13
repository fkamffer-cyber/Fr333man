import InviteLanding from "./InviteLanding";
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InviteLanding id={id} />;
}
