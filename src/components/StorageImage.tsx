import { useQuery } from "@tanstack/react-query";
import { getSignedUrl } from "@/lib/storage-url";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: string | null;
  fallback?: React.ReactNode;
};

export function StorageImage({ src, fallback = null, alt = "", ...rest }: Props) {
  const { data } = useQuery({
    queryKey: ["signed-url", src ?? ""],
    queryFn: () => getSignedUrl(src),
    enabled: !!src,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  if (!src) return <>{fallback}</>;
  if (!data) return <>{fallback}</>;
  return <img src={data} alt={alt} {...rest} />;
}
