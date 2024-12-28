export class Seat {
    login: string;
    id: number;
    assigning_team: string;
    created_at: string;
    last_activity_at: string;
    last_activity_editor: string;
    refresh_time: string;

    constructor(data: any) {
        if (!data.assignee) {  // there is no assignee in the data. This is the case when the assignee is from the database. When it is from the database, it is a seat object
           //console.error("Assignee data is missing for item:", JSON.stringify(data, null, 2));
            //throw new Error("Assignee data is missing");
            this.login = data.login;
            this.id = data.id;
            this.assigning_team = data.assigning_team;
            this.created_at = data.created_at;
            this.last_activity_at = data.last_activity_at;
            this.last_activity_editor = data.last_activity_editor;
            this.refresh_time = data.refresh_time;
        }
        else { // the assignee is from the GitHub API. when it is there, it is an assignee object, and it does include many other fields
            this.login = data.assignee.login;
            this.id = data.assignee.id;
            this.assigning_team = data.assigning_team ? data.assigning_team.name : '';
            this.created_at = data.created_at;
            this.last_activity_at = data.last_activity_at;
            this.last_activity_editor = data.last_activity_editor;
            this.refresh_time = new Date().toDateString();
        }
    }
}

export class TotalSeats {
    total_seats: number;
    seats: Seat[];

    constructor(seats: Seat[]) {
        if (!Array.isArray(seats)) {
            throw new Error("Seats must be an array");
        }
        this.total_seats = seats.length;
        this.seats = seats;
        //console.log('TotalSeats data received:', JSON.stringify(seats, null, 2));
    }
}