export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">訂單 {id} — Coming Soon</h1>
    </main>
  );
}
