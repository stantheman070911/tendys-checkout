export default function OrderPage({ params }: { params: { id: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">訂單 {params.id} — Coming Soon</h1>
    </main>
  );
}
