import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "!bg-card !text-card-foreground !border-border !rounded-xl !shadow-lg !px-4 !py-3",
          title: "!text-sm !font-medium !text-foreground",
          description: "!text-xs !text-muted-foreground",
          success: "!border-border",
          error: "!border-border",
          actionButton: "!bg-primary !text-primary-foreground !rounded-lg",
          cancelButton: "!bg-muted !text-muted-foreground !rounded-lg",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
