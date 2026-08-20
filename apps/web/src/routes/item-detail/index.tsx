import { useParams } from "react-router";

export function ItemDetailPage() {
  const { itemId } = useParams();

  return (
    <div>
      <h1 className="text-3xl font-bold">Item Detail</h1>
      <p className="mt-2 text-muted-foreground">Item ID: {itemId}</p>
    </div>
  );
}
