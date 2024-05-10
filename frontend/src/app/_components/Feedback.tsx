import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useCallback, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Alert } from "@mui/material";
import { useTranslations } from "next-intl";
import { api } from "~/trpc/react";

export default function Feedback() {
  const [open, setOpen] = useState(true);
  const [thankYou, setThankYou] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitFeedback = api.post.feedback.useMutation();
  const t = useTranslations("Feedback");

  const handleCloseTy = useCallback(() => setThankYou(false), []);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const formJson = Object.fromEntries(formData.entries());

      const email = formJson.email as string;
      const feedback = formJson.feedback as string;
      setLoading(true);
      const submit = async () => {
        try {
          const ret = await submitFeedback.mutateAsync({ email, feedback });
          if (ret) {
            handleClose();
            setThankYou(true);
          } else setError(t("generic_error"));
        } catch (e) {
          if (e instanceof Error) {
            setError(e.message);
          } else setError(t("generic_error"));
        } finally {
          setLoading(false);
        }
      };
      void submit();
    },
    [handleClose, submitFeedback, t],
  );
  return (
    <li className="product-feedback">
      <Button onClick={handleOpen}>{t("button")}</Button>
      <Dialog open={thankYou} onClose={handleCloseTy}>
        <DialogTitle className="text-center">{t("thankyou_title")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("thankyou_text")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTy}>{t("thankyou_close")}</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={open}
        onClose={handleClose}
        PaperProps={{
          component: "form",
          onSubmit: handleSubmit,
        }}
      >
        <DialogTitle className="text-center">{t("title")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("text")}</DialogContentText>
          {Boolean(error) && (
            <Alert className="mt-4" color="error">
              {error}
            </Alert>
          )}
          <TextField
            margin="dense"
            id="name"
            name="email"
            label={t("email_label")}
            type="email"
            fullWidth
            variant="standard"
          />
          <TextField
            autoFocus
            required
            margin="dense"
            id="feedback"
            name="feedback"
            label={t("feedback_label")}
            multiline
            fullWidth
            rows={10}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            {t("cancel_button")}
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading && (
              <FontAwesomeIcon className="mr-2" icon={faSpinner} spin />
            )}
            {t("submit_button")}
          </Button>
        </DialogActions>
      </Dialog>
    </li>
  );
}
