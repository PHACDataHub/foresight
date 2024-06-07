"use client";

import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";
import Badge from "@mui/material/Badge";
import Avatar from "@mui/material/Avatar";

import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";

import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useStore } from "~/app/_store";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Stack } from "@mui/material";
import { LogOutIcon } from "lucide-react";

const SmallAvatar = styled(Avatar)(({ theme }) => ({
  width: 22,
  height: 22,
  border: `2px solid ${theme.palette.background.paper}`,
}));

export default function SignOut() {
  const t = useTranslations("SignOut");
  const session = useSession();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = useMemo(() => Boolean(anchorEl), [anchorEl]);
  const { data: personas } = api.post.personas.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { persona, setPersona } = useStore();

  const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleAvatarClose = useCallback(() => {
    setAnchorEl(null);
  }, []);
  const handleClick = useCallback(async () => {
    setAnchorEl(null);
    await signOut({ callbackUrl: "/" });
  }, []);
  const handlePersonaClick = useCallback(
    (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      setAnchorEl(null);
      setPersona(evt.currentTarget.getAttribute("data-value") ?? "alice");
    },
    [setPersona],
  );

  const activePersona = useMemo(() => {
    if (!personas) return undefined;
    return personas.find((p) => p.id === persona);
  }, [persona, personas]);

  if (session.status !== "authenticated") return;
  return (
    <li className="profile">
      <IconButton
        onClick={handleAvatarClick}
        size="small"
        sx={{ ml: 2 }}
        aria-controls={open ? "account-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
      >
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          badgeContent={
            <SmallAvatar
              alt={session.data.user.name ?? "User"}
              src={session.data.user.image ?? ""}
            />
          }
        >
          {!personas && <FontAwesomeIcon icon={faSpinner} spin fontSize={35} />}
          {personas && activePersona && (
            <Avatar alt={activePersona.name} src={activePersona.image} />
          )}
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        id="account-menu"
        open={open}
        onClose={handleAvatarClose}
        onClick={handleAvatarClose}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              overflow: "visible",
              filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.32))",
              minWidth: 300,
              mt: 1.5,
              "& .MuiAvatar-root": {
                width: 32,
                height: 32,
                ml: -0.5,
                mr: 1,
              },
              "&::before": {
                content: '""',
                display: "block",
                position: "absolute",
                top: 0,
                right: 14,
                width: 10,
                height: 10,
                bgcolor: "background.paper",
                transform: "translateY(-50%) rotate(45deg)",
                zIndex: 0,
              },
            },
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <Typography variant="caption" sx={{ paddingLeft: 2 }}>
          Personas
        </Typography>
        {personas?.map((p) => (
          <MenuItem
            key={p.id}
            href=""
            onClick={handlePersonaClick}
            data-value={p.id}
            selected={p.id === persona}
          >
            <Avatar src={p.image} /> {p.name}
          </MenuItem>
        ))}
        <Divider />
        <Typography variant="caption" sx={{ paddingLeft: 2 }}>
          Logged in as:
        </Typography>
        <Stack
          alignItems="center"
          direction="row"
          sx={{ padding: "6px 16px 6px 16px", marginBottom: 1 }}
        >
          <Avatar src={session.data.user.image ?? ""} />
          <Typography variant="body1" sx={{ fontWeight: "bold" }}>
            {session.data.user.name}
          </Typography>
        </Stack>
        <Divider />
        <MenuItem onClick={handleClick} sx={{ paddingTop: 2 }}>
          <ListItemIcon>
            <LogOutIcon />
          </ListItemIcon>
          {t("button")}
        </MenuItem>
      </Menu>
    </li>
  );
}
