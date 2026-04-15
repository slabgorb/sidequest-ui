import { useImageBus } from "@/providers/ImageBusProvider";
import { ScrapbookGallery } from "./ScrapbookGallery";

export function ImageGalleryWidget() {
  const images = useImageBus();
  return <ScrapbookGallery images={images} />;
}
