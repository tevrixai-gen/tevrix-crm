export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Tevrix AI</h1>
          <p className="text-sm text-muted-foreground mt-1">Voice AI for your business</p>
        </div>
        {children}
      </div>
    </div>
  );
}
