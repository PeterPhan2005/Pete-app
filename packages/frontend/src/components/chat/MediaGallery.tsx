import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChatStore } from "@/stores/useChatStore";
import { FileIcon, Image, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface MediaGalleryProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface MediaItem {
  type: "image" | "video" | "file";
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
}

export function MediaGallery({ conversationId, isOpen, onClose }: MediaGalleryProps) {
  const { getMediaMessages } = useChatStore();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && conversationId) {
      loadMedia();
    }
  }, [isOpen, conversationId]);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const mediaItems = await getMediaMessages(conversationId);
      setMedia(mediaItems);
    } catch (error) {
      toast.error("Không thể tải media");
    } finally {
      setLoading(false);
    }
  };

  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video");
  const files = media.filter((m) => m.type === "file");

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Media & Files</SheetTitle>
          <SheetDescription>
            Tất cả media và file trong cuộc trò chuyện này
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="images" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="images">
              <Image className="h-4 w-4 mr-2" />
              Hình ảnh ({images.length})
            </TabsTrigger>
            <TabsTrigger value="videos">
              <Video className="h-4 w-4 mr-2" />
              Video ({videos.length})
            </TabsTrigger>
            <TabsTrigger value="files">
              <FileIcon className="h-4 w-4 mr-2" />
              Files ({files.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có hình ảnh nào</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <a
                    key={idx}
                    href={img.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={img.fileUrl}
                      alt={img.fileName}
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có video nào</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {videos.map((vid, idx) => (
                  <a
                    key={idx}
                    href={vid.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-video rounded-lg overflow-hidden hover:opacity-80 transition-opacity bg-muted"
                  >
                    <video
                      src={vid.fileUrl}
                      className="w-full h-full object-cover"
                      controls={false}
                    />
                  </a>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có file nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file, idx) => (
                  <a
                    key={idx}
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                  >
                    <FileIcon className="h-8 w-8 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.fileSize)} • {file.fileMimeType}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
