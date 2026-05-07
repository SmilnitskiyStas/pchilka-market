export default function InventoryLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body > header,
            body > footer {
              display: none !important;
            }
          `
        }}
      />
      {children}
    </>
  );
}
