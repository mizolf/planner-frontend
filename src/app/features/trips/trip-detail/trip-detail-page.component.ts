import {
  Component,
  computed,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { Subscription } from "rxjs";
import {
  TripActivityResponse,
  TripDayResponse,
} from "../../../core/models/trip.model";
import { TripService } from "../../../core/services/trip.service";
import { UserService } from "../../../core/services/user.service";
import { AddDayDialogComponent } from "./add-day-dialog.component";
import { DeleteDayDialogComponent } from "./delete-day-dialog.component";
import { EditTripDialogComponent } from "./edit-trip-dialog.component";
import { DeleteTripDialogComponent } from "./delete-trip-dialog.component";
import { AddActivityDialogComponent } from "./add-activity-dialog.component";
import { EditActivityDialogComponent } from "./edit-activity-dialog.component";
import { InviteMemberDialogComponent } from "./invite-member-dialog.component";
import { PendingInvitesSectionComponent } from "./pending-invites-section.component";
import { TripInviteResponse } from "../../../core/models/invite.model";
import { TripDayCardComponent } from "./trip-day-card.component";
import { TripDayPickerComponent } from "./trip-day-picker.component";
import { TripDetailHeaderComponent } from "./trip-detail-header.component";
import { TripMembersSectionComponent } from "./trip-members-section.component";

@Component({
  selector: "app-trip-detail-page",
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    AddDayDialogComponent,
    AddActivityDialogComponent,
    EditActivityDialogComponent,
    DeleteDayDialogComponent,
    EditTripDialogComponent,
    DeleteTripDialogComponent,
    InviteMemberDialogComponent,
    PendingInvitesSectionComponent,
    TripDayCardComponent,
    TripDayPickerComponent,
    TripDetailHeaderComponent,
    TripMembersSectionComponent,
  ],
  templateUrl: "./trip-detail-page.component.html",
})
export class TripDetailPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly tripService = inject(TripService);
  private readonly userService = inject(UserService);

  readonly trip = this.tripService.tripDetail;
  readonly loading = this.tripService.detailLoading;
  readonly error = this.tripService.detailError;

  readonly currentUserRole = computed(() => {
    const t = this.trip();
    const user = this.userService.currentUser();
    if (!t || !user) return null;
    return t.members.find((m) => m.userId === user.id)?.role ?? null;
  });

  readonly isOwner = computed(() => this.currentUserRole() === "OWNER");

  readonly canEditContent = computed(() => {
    const role = this.currentUserRole();
    return role === "OWNER" || role === "EDITOR";
  });

  private readonly userSelectedDayId = signal<number | null>(null);

  @ViewChild(AddDayDialogComponent) addDayDialog?: AddDayDialogComponent;
  @ViewChild(DeleteDayDialogComponent)
  deleteDayDialog?: DeleteDayDialogComponent;

  @ViewChild(EditTripDialogComponent) editTripDialog?: EditTripDialogComponent;

  @ViewChild(DeleteTripDialogComponent)
  deleteTripDialog?: DeleteTripDialogComponent;

  @ViewChild(AddActivityDialogComponent)
  addActivityDialog?: AddActivityDialogComponent;

  @ViewChild(EditActivityDialogComponent)
  editActivityDialog?: EditActivityDialogComponent;

  @ViewChild(InviteMemberDialogComponent)
  inviteMemberDialog?: InviteMemberDialogComponent;

  @ViewChild(PendingInvitesSectionComponent)
  pendingInvitesSection?: PendingInvitesSectionComponent;

  private paramSub?: Subscription;

  readonly selectedDay = computed(() => {
    const t = this.trip();
    if (!t || t.days.length === 0) return null;
    const sorted = [...t.days].sort((a, b) => a.dayNumber - b.dayNumber);
    const explicit = this.userSelectedDayId();
    if (explicit !== null) {
      const found = t.days.find((d) => d.id === explicit);
      if (found) return found;
    }
    return sorted[0];
  });

  readonly selectedDayId = computed(() => this.selectedDay()?.id ?? null);

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe((params) => {
      const raw = params.get("id");
      const id = Number(raw);
      if (raw === null || !Number.isFinite(id) || id <= 0) {
        return;
      }
      this.userSelectedDayId.set(null);
      this.tripService.loadTripDetail(id);
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    this.tripService.clearTripDetail();
  }

  selectDay(id: number): void {
    this.userSelectedDayId.set(id);
  }

  openEditTrip(): void {
    const t = this.trip();
    if (!t) return;
    this.editTripDialog?.open(t);
  }

  openDeleteTrip(): void {
    const t = this.trip();
    if (!t) return;
    this.deleteTripDialog?.open(t);
  }

  openAddDay(): void {
    this.addDayDialog?.open();
  }

  openAddActivity(day: TripDayResponse): void {
    const trip = this.trip();
    if (!trip) return;
    this.addActivityDialog?.open(trip.id, day.id);
  }

  openEditActivity(day: TripDayResponse, activity: TripActivityResponse): void {
    const trip = this.trip();
    if (!trip) return;
    this.editActivityDialog?.open(trip.id, day.id, activity);
  }

  openDeleteDay(day: TripDayResponse): void {
    const t = this.trip();
    if (!t) return;
    this.deleteDayDialog?.open(t.id, day);
  }

  openInviteMember(): void {
    const t = this.trip();
    if (!t) return;
    this.inviteMemberDialog?.open(t.id);
  }

  onInvited(created: TripInviteResponse): void {
    this.pendingInvitesSection?.addInvite(created);
  }
}
