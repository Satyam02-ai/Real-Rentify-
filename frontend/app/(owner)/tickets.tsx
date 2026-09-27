import { View } from "react-native";
import { Header } from "@/src/components/layout";
import { TicketsList } from "@/src/screens/TicketsList";
import { useTheme } from "@/src/theme";

export default function OwnerTickets() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      <Header title="Maintenance" onBack />
      <TicketsList role="owner" detailBase="/(owner)/ticket" />
    </View>
  );
}
