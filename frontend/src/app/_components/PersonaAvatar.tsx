"use client";

import { useMemo } from "react";

import { useSession } from "next-auth/react";

import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import { styled } from "@mui/material/styles";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

import { api } from "~/trpc/react";

const SmallAvatar = styled(Avatar)(({ theme }) => ({
  width: 22,
  height: 22,
  border: `2px solid ${theme.palette.background.paper}`,
}));

const TinyAvatar = styled(Avatar)(({ theme }) => ({
    width: 12,
    height: 12,
    border: `2px solid ${theme.palette.background.paper}`,
  }));
  

export default function PersonaAvatar({
  persona,
  showAccount,
  size,
}: {
  persona: string;
  size?: "small" | "normal";
  showAccount?: boolean;
}) {
  const session = useSession();

  const { data: personas } = api.post.personas.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const activePersona = useMemo(() => {
    if (!personas) return undefined;
    return personas.find((p) => p.id === persona);
  }, [persona, personas]);

  const AccountAvatar = size === "small" ? TinyAvatar : SmallAvatar;

  if (session.status !== "authenticated") return;
  if (showAccount === true)
    return (
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        badgeContent={
          <AccountAvatar
            alt={session.data.user.name ?? "User"}
            src={session.data.user.image ?? ""}
          />
        }
      >
        {!personas && <FontAwesomeIcon icon={faSpinner} spin fontSize={35} />}
        {personas && activePersona && (
          <Avatar
            style={size === "small" ? { width: 22, height: 22 } : undefined}
            alt={activePersona.name}
            src={activePersona.image}
          />
        )}
      </Badge>
    );
  if (!personas || !activePersona)
    return <FontAwesomeIcon icon={faSpinner} spin fontSize={size === "small" ? 15 :35} />;
  return (
    <Avatar
      style={size === "small" ? { width: 22, height: 22 } : undefined}
      alt={activePersona.name}
      src={activePersona.image}
    />
  );
}
