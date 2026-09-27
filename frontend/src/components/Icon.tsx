import React from "react";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";

type Props = {
  name: string;
  size?: number;
  color?: string;
  style?: any;
};

export function Icon({ name, size = 24, color = "#000", style }: Props) {
  const Comp = MaterialDesignIcons as any;
  return <Comp name={name} size={size} color={color} style={style} />;
}
