/* =========================================================================
   Hospital Management System – Vue 3 SPA  (CDN build, single file)
   Uses:  Vue 3 global, Vue Router 4 global, Axios global, Bootstrap 5
   ========================================================================= */

// ── Axios defaults ──────────────────────────────────────────────────
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(cfg => {
    const t = localStorage.getItem('hms_token');
    if (t) cfg.headers.Authorization = 'Bearer ' + t;
    return cfg;
});
api.interceptors.response.use(r => r, err => {
    if (err.response && err.response.status === 401) {
        localStorage.removeItem('hms_token');
        localStorage.removeItem('hms_user');
        window.location.hash = '#/login';
    }
    return Promise.reject(err);
});

// ── Auth helper ─────────────────────────────────────────────────────
const Auth = {
    get user() { try { return JSON.parse(localStorage.getItem('hms_user')); } catch { return null; } },
    get token() { return localStorage.getItem('hms_token'); },
    get role() { return this.user?.role || ''; },
    get loggedIn() { return !!this.token; },
    save(token, user) { localStorage.setItem('hms_token', token); localStorage.setItem('hms_user', JSON.stringify(user)); },
    logout() { localStorage.removeItem('hms_token'); localStorage.removeItem('hms_user'); },
};

/* =====================================================================
   COMPONENTS
   ===================================================================== */

// ── Navbar ──────────────────────────────────────────────────────────
const Navbar = {
    template: `
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary mb-4">
      <div class="container">
        <router-link class="navbar-brand" to="/"><i class="bi bi-hospital"></i> HMS</router-link>
        <button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#nav"><span class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="nav">
          <ul class="navbar-nav me-auto">
            <li v-if="role==='admin'" class="nav-item"><router-link class="nav-link" to="/admin">Dashboard</router-link></li>
            <li v-if="role==='doctor'" class="nav-item"><router-link class="nav-link" to="/doctor">Dashboard</router-link></li>
            <li v-if="role==='patient'" class="nav-item"><router-link class="nav-link" to="/patient">Dashboard</router-link></li>
          </ul>
          <ul class="navbar-nav">
            <template v-if="loggedIn">
              <li class="nav-item"><span class="nav-link text-light"><i class="bi bi-person-circle"></i> {{username}} ({{role}})</span></li>
              <li class="nav-item"><a class="nav-link" href="#" @click.prevent="logout"><i class="bi bi-box-arrow-right"></i> Logout</a></li>
            </template>
            <template v-else>
              <li class="nav-item"><router-link class="nav-link" to="/login">Login</router-link></li>
              <li class="nav-item"><router-link class="nav-link" to="/register">Register</router-link></li>
            </template>
          </ul>
        </div>
      </div>
    </nav>`,
    computed: {
        loggedIn() { return Auth.loggedIn; },
        role() { return Auth.role; },
        username() { return Auth.user?.username || ''; },
    },
    methods: { logout() { Auth.logout(); this.$router.push('/login'); } },
};

// ── Login ───────────────────────────────────────────────────────────
const LoginPage = {
    template: `
    <div class="row justify-content-center">
      <div class="col-md-5">
        <div class="card shadow">
          <div class="card-body">
            <h4 class="card-title text-center mb-4"><i class="bi bi-box-arrow-in-right"></i> Login</h4>
            <div v-if="err" class="alert alert-danger">{{err}}</div>
            <div class="mb-3"><label class="form-label">Email</label><input v-model="email" class="form-control" type="email" /></div>
            <div class="mb-3"><label class="form-label">Password</label><input v-model="password" class="form-control" type="password" /></div>
            <button class="btn btn-primary w-100" @click="submit" :disabled="loading">{{loading?'Logging in…':'Login'}}</button>
            <p class="mt-3 text-center">New patient? <router-link to="/register">Register</router-link></p>
          </div>
        </div>
      </div>
    </div>`,
    data() { return { email: '', password: '', err: '', loading: false }; },
    methods: {
        async submit() {
            this.err = ''; this.loading = true;
            try {
                const { data } = await api.post('/auth/login', { email: this.email, password: this.password });
                Auth.save(data.token, data.user);
                const dest = { admin: '/admin', doctor: '/doctor', patient: '/patient' };
                this.$router.push(dest[data.user.role] || '/');
            } catch (e) { this.err = e.response?.data?.msg || 'Login failed'; }
            this.loading = false;
        },
    },
};

// ── Register ────────────────────────────────────────────────────────
const RegisterPage = {
    template: `
    <div class="row justify-content-center">
      <div class="col-md-6">
        <div class="card shadow">
          <div class="card-body">
            <h4 class="card-title text-center mb-4"><i class="bi bi-person-plus"></i> Patient Registration</h4>
            <div v-if="err" class="alert alert-danger">{{err}}</div>
            <div class="row">
              <div class="col-md-6 mb-3"><label class="form-label">Username</label><input v-model="form.username" class="form-control" /></div>
              <div class="col-md-6 mb-3"><label class="form-label">Email</label><input v-model="form.email" class="form-control" type="email"/></div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-3"><label class="form-label">Password</label><input v-model="form.password" class="form-control" type="password"/></div>
              <div class="col-md-6 mb-3"><label class="form-label">Phone</label><input v-model="form.phone" class="form-control"/></div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-3"><label class="form-label">Address</label><input v-model="form.address" class="form-control"/></div>
              <div class="col-md-6 mb-3"><label class="form-label">Date of Birth</label><input v-model="form.date_of_birth" class="form-control" type="date"/></div>
            </div>
            <button class="btn btn-success w-100" @click="submit" :disabled="loading">{{loading?'Registering…':'Register'}}</button>
            <p class="mt-3 text-center">Already have account? <router-link to="/login">Login</router-link></p>
          </div>
        </div>
      </div>
    </div>`,
    data() { return { form: { username:'',email:'',password:'',phone:'',address:'',date_of_birth:'' }, err:'', loading:false }; },
    methods: {
        async submit() {
            this.err=''; this.loading=true;
            try {
                const { data } = await api.post('/auth/register', this.form);
                Auth.save(data.token, data.user);
                this.$router.push('/patient');
            } catch(e) { this.err = e.response?.data?.msg || 'Registration failed'; }
            this.loading=false;
        },
    },
};

/* =====================================================================
   ADMIN  PAGES
   ===================================================================== */
const AdminDashboard = {
    template: `
    <div>
      <h3 class="mb-4"><i class="bi bi-speedometer2"></i> Admin Dashboard</h3>
      <div class="row mb-4">
        <div class="col-md-4"><div class="card text-bg-primary shadow"><div class="card-body text-center"><h5>Doctors</h5><h2>{{stats.total_doctors}}</h2></div></div></div>
        <div class="col-md-4"><div class="card text-bg-success shadow"><div class="card-body text-center"><h5>Patients</h5><h2>{{stats.total_patients}}</h2></div></div></div>
        <div class="col-md-4"><div class="card text-bg-info shadow"><div class="card-body text-center"><h5>Appointments</h5><h2>{{stats.total_appointments}}</h2></div></div></div>
      </div>

      <!-- tabs -->
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item"><a class="nav-link" :class="{active:tab==='doctors'}" href="#" @click.prevent="tab='doctors'">Doctors</a></li>
        <li class="nav-item"><a class="nav-link" :class="{active:tab==='patients'}" href="#" @click.prevent="tab='patients'">Patients</a></li>
        <li class="nav-item"><a class="nav-link" :class="{active:tab==='appointments'}" href="#" @click.prevent="tab='appointments'">Appointments</a></li>
      </ul>

      <!-- Doctors -->
      <div v-if="tab==='doctors'">
        <div class="row mb-3">
          <div class="col-md-6"><input v-model="docSearch" class="form-control" placeholder="Search doctors by name or specialization" @input="searchDoctors"/></div>
          <div class="col-md-6 text-end"><button class="btn btn-primary" @click="showAddDoc=true"><i class="bi bi-plus-circle"></i> Add Doctor</button></div>
        </div>
        <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark"><tr><th>ID</th><th>Name</th><th>Email</th><th>Specialization</th><th>Department</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="d in filteredDoctors" :key="d.id">
              <td>{{d.id}}</td><td>{{d.username}}</td><td>{{d.email}}</td><td>{{d.specialization}}</td><td>{{d.department||'-'}}</td>
              <td><span :class="d.is_active?'badge bg-success':'badge bg-danger'">{{d.is_active?'Yes':'No'}}</span></td>
              <td>
                <button class="btn btn-sm btn-warning me-1" @click="editDoctor(d)"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger me-1" @click="deleteDoctor(d)"><i class="bi bi-trash"></i></button>
                <button class="btn btn-sm" :class="d.is_active?'btn-secondary':'btn-success'" @click="toggleBlacklist(d.user_id)">{{d.is_active?'Blacklist':'Activate'}}</button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <!-- Patients -->
      <div v-if="tab==='patients'">
        <div class="mb-3"><input v-model="patSearch" class="form-control" placeholder="Search patients by name or ID" @input="searchPatients"/></div>
        <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark"><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="p in filteredPatients" :key="p.id">
              <td>{{p.id}}</td><td>{{p.username}}</td><td>{{p.email}}</td><td>{{p.phone||'-'}}</td>
              <td><span :class="p.is_active?'badge bg-success':'badge bg-danger'">{{p.is_active?'Yes':'No'}}</span></td>
              <td>
                <button class="btn btn-sm btn-outline-info me-1" @click="viewPatHistory(p.id)"><i class="bi bi-clock-history"></i> History</button>
                <button class="btn btn-sm" :class="p.is_active?'btn-secondary':'btn-success'" @click="toggleBlacklist(p.user_id)">{{p.is_active?'Blacklist':'Activate'}}</button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <!-- Appointments -->
      <div v-if="tab==='appointments'">
        <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark"><tr><th>ID</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="a in appointments" :key="a.id">
              <td>{{a.id}}</td><td>{{a.patient_name}}</td><td>{{a.doctor_name}}</td><td>{{a.appointment_date}}</td><td>{{a.appointment_time}}</td>
              <td><span class="badge" :class="{'bg-primary':a.status==='booked','bg-success':a.status==='completed','bg-danger':a.status==='cancelled'}">{{a.status}}</span></td>
              <td><button class="btn btn-sm btn-outline-info" @click="viewPatHistory(a.patient_id)"><i class="bi bi-clock-history"></i> History</button></td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <!-- Add / Edit Doctor Modal -->
      <div v-if="showAddDoc||editDoc" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">{{editDoc?'Edit':'Add'}} Doctor</h5><button class="btn-close" @click="closeDocModal"></button></div>
          <div class="modal-body">
            <div v-if="docErr" class="alert alert-danger">{{docErr}}</div>
            <div class="mb-3"><label class="form-label">Username</label><input v-model="docForm.username" class="form-control"/></div>
            <div class="mb-3"><label class="form-label">Email</label><input v-model="docForm.email" class="form-control" type="email"/></div>
            <div v-if="!editDoc" class="mb-3"><label class="form-label">Password</label><input v-model="docForm.password" class="form-control" type="password"/></div>
            <div class="mb-3"><label class="form-label">Specialization</label><input v-model="docForm.specialization" class="form-control"/></div>
            <div class="mb-3"><label class="form-label">Department</label>
              <select v-model="docForm.department_id" class="form-select">
                <option value="">-- select --</option>
                <option v-for="dep in departments" :key="dep.id" :value="dep.id">{{dep.name}}</option>
              </select>
            </div>
            <div class="row">
              <div class="col-md-6 mb-3"><label class="form-label">Qualification</label><input v-model="docForm.qualification" class="form-control" placeholder="MBBS, MD…"/></div>
              <div class="col-md-6 mb-3"><label class="form-label">Experience (years)</label><input v-model.number="docForm.experience_years" class="form-control" type="number" min="0"/></div>
            </div>
            <div class="mb-3"><label class="form-label">Bio</label><textarea v-model="docForm.bio" class="form-control" rows="2" placeholder="Short bio…"></textarea></div>
          </div>
          <div class="modal-footer"><button class="btn btn-secondary" @click="closeDocModal">Cancel</button><button class="btn btn-primary" @click="saveDoctor">{{editDoc?'Update':'Add'}}</button></div>
        </div></div>
      </div>

      <!-- Patient History Modal -->
      <div v-if="patHistoryData" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog modal-xl"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Patient History: {{patHistoryData.patient.username}}</h5><button class="btn-close" @click="patHistoryData=null"></button></div>
          <div class="modal-body">
            <div v-if="!patHistoryData.history.length" class="text-muted">No treatment records found.</div>
            <div class="table-responsive" v-else>
              <table class="table table-hover">
                <thead class="table-dark"><tr><th>#</th><th>Date</th><th>Doctor</th><th>Visit Type</th><th>Tests Done</th><th>Diagnosis</th><th>Prescription</th><th>Medicines</th></tr></thead>
                <tbody>
                  <tr v-for="(a,i) in patHistoryData.history" :key="a.id">
                    <td>{{i+1}}</td><td>{{a.appointment_date}}</td><td>{{a.doctor_name}}</td>
                    <td>{{a.treatment.visit_type||'-'}}</td><td>{{a.treatment.tests_done||'-'}}</td>
                    <td>{{a.treatment.diagnosis}}</td><td>{{a.treatment.prescription||'-'}}</td>
                    <td>{{a.treatment.medicines||'-'}}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer"><button class="btn btn-secondary" @click="patHistoryData=null">Close</button></div>
        </div></div>
      </div>
    </div>`,
    data() { return { stats:{}, tab:'doctors', doctors:[], patients:[], appointments:[], departments:[], docSearch:'', patSearch:'', filteredDoctors:[], filteredPatients:[], showAddDoc:false, editDoc:null, docForm:{username:'',email:'',password:'',specialization:'',department_id:'',qualification:'',experience_years:'',bio:''}, docErr:'', patHistoryData:null }; },
    async created() { await this.load(); },
    methods: {
        async load() {
            const [s,d,p,a,dep] = await Promise.all([
                api.get('/admin/dashboard'), api.get('/admin/doctors'), api.get('/admin/patients'),
                api.get('/admin/appointments'), api.get('/admin/departments'),
            ]);
            this.stats=s.data; this.doctors=d.data; this.filteredDoctors=d.data;
            this.patients=p.data; this.filteredPatients=p.data; this.appointments=a.data; this.departments=dep.data;
        },
        searchDoctors() {
            const q = this.docSearch.toLowerCase();
            if(!q){ this.filteredDoctors=this.doctors; return; }
            api.get('/admin/doctors/search?q='+encodeURIComponent(q)).then(r=>this.filteredDoctors=r.data);
        },
        searchPatients() {
            const q = this.patSearch.toLowerCase();
            if(!q){ this.filteredPatients=this.patients; return; }
            api.get('/admin/patients/search?q='+encodeURIComponent(q)).then(r=>this.filteredPatients=r.data);
        },
        editDoctor(d) { this.editDoc=d; this.docForm={username:d.username,email:d.email,password:'',specialization:d.specialization,department_id:d.department_id||'',qualification:d.qualification||'',experience_years:d.experience_years||'',bio:d.bio||''}; },
        closeDocModal() { this.showAddDoc=false; this.editDoc=null; this.docForm={username:'',email:'',password:'',specialization:'',department_id:'',qualification:'',experience_years:'',bio:''}; this.docErr=''; },
        async saveDoctor() {
            this.docErr='';
            try {
                if(this.editDoc) { await api.put('/admin/doctors/'+this.editDoc.id, this.docForm); }
                else { await api.post('/admin/doctors', this.docForm); }
                this.closeDocModal(); await this.load();
            } catch(e) { this.docErr=e.response?.data?.msg||'Failed'; }
        },
        async deleteDoctor(d) { if(!confirm('Delete Dr. '+d.username+'?')) return; await api.delete('/admin/doctors/'+d.id); await this.load(); },
        async toggleBlacklist(uid) { await api.put('/admin/blacklist/'+uid); await this.load(); },
        async viewPatHistory(pid) {
            const r = await api.get('/admin/patients/'+pid+'/history');
            this.patHistoryData = r.data;
        },
    },
};

/* =====================================================================
   DOCTOR  PAGES
   ===================================================================== */
const DoctorDashboard = {
    template: `
    <div>
      <h3 class="mb-4"><i class="bi bi-heart-pulse"></i> Doctor Dashboard</h3>
      <div class="row mb-4">
        <div class="col-md-4"><div class="card text-bg-info shadow"><div class="card-body text-center"><h5>Upcoming</h5><h2>{{upcoming.length}}</h2></div></div></div>
        <div class="col-md-4"><div class="card text-bg-success shadow"><div class="card-body text-center"><h5>Patients Served</h5><h2>{{patientCount}}</h2></div></div></div>
      </div>

      <ul class="nav nav-tabs mb-3">
        <li class="nav-item"><a class="nav-link" :class="{active:tab==='upcoming'}" href="#" @click.prevent="tab='upcoming'">Upcoming</a></li>
        <li class="nav-item"><a class="nav-link" :class="{active:tab==='history'}" href="#" @click.prevent="tab='history'">History</a></li>
        <li class="nav-item"><a class="nav-link" :class="{active:tab==='availability'}" href="#" @click.prevent="tab='availability'">Availability</a></li>
        <li class="nav-item"><a class="nav-link" :class="{active:tab==='patients'}" href="#" @click.prevent="tab='patients'">My Patients</a></li>
      </ul>

      <!-- Patient History Drilldown -->
      <div v-if="patHistoryData">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0">Patient History: {{patHistoryData.patient.username}}</h5>
          <button class="btn btn-sm btn-secondary" @click="patHistoryData=null"><i class="bi bi-arrow-left"></i> Back</button>
        </div>
        <div v-if="!patHistoryData.history.length" class="text-muted">No treatment records found.</div>
        <div class="table-responsive" v-else>
          <table class="table table-hover">
            <thead class="table-dark"><tr><th>#</th><th>Date</th><th>Doctor</th><th>Visit Type</th><th>Tests Done</th><th>Diagnosis</th><th>Prescription</th><th>Medicines</th></tr></thead>
            <tbody>
              <tr v-for="(a,i) in patHistoryData.history" :key="a.id">
                <td>{{i+1}}</td><td>{{a.appointment_date}}</td><td>{{a.doctor_name}}</td>
                <td>{{a.treatment.visit_type||'-'}}</td><td>{{a.treatment.tests_done||'-'}}</td>
                <td>{{a.treatment.diagnosis}}</td><td>{{a.treatment.prescription||'-'}}</td>
                <td>{{a.treatment.medicines||'-'}}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="!patHistoryData">
      <div v-if="tab==='upcoming'">
        <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-dark"><tr><th>Date</th><th>Time</th><th>Patient</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="a in upcoming" :key="a.id">
              <td>{{a.appointment_date}}</td><td>{{a.appointment_time}}</td><td>{{a.patient_name}}</td>
              <td><span class="badge bg-primary">{{a.status}}</span></td>
              <td>
                <button class="btn btn-sm btn-success me-1" @click="markStatus(a.id,'completed')"><i class="bi bi-check-circle"></i> Complete</button>
                <button class="btn btn-sm btn-danger me-1" @click="markStatus(a.id,'cancelled')"><i class="bi bi-x-circle"></i> Cancel</button>
                <button class="btn btn-sm btn-info" @click="openTreatment(a)"><i class="bi bi-clipboard-pulse"></i> Treatment</button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <!-- History -->
      <div v-if="tab==='history'">
        <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-dark"><tr><th>Date</th><th>Time</th><th>Patient</th><th>Status</th><th>Diagnosis</th></tr></thead>
          <tbody>
            <tr v-for="a in history" :key="a.id">
              <td>{{a.appointment_date}}</td><td>{{a.appointment_time}}</td><td>{{a.patient_name}}</td>
              <td><span class="badge" :class="{'bg-success':a.status==='completed','bg-danger':a.status==='cancelled','bg-primary':a.status==='booked'}">{{a.status}}</span></td>
              <td>{{a.treatment?a.treatment.diagnosis:'-'}}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <!-- Availability -->
      <div v-if="tab==='availability'">
        <div class="card shadow p-3 mb-3">
          <p class="text-muted">Click to enable/disable slots for each day. <span class="badge bg-success">Green = Morning</span> <span class="badge bg-danger ms-1">Red = Evening</span></p>
          <div v-for="d in next7" :key="d" class="mb-3 border rounded p-2">
            <div class="fw-bold mb-2">{{d}}</div>
            <div class="mb-1">
              <small class="text-muted me-2">Morning</small>
              <button v-for="s in morningSlots" :key="d+s" class="btn btn-sm me-1 mb-1"
                :class="isSlotEnabled(d,s)?'btn-success':'btn-outline-secondary'"
                @click="toggleSlot(d,s)">{{s}}</button>
            </div>
            <div>
              <small class="text-muted me-2">Evening</small>
              <button v-for="s in eveningSlots" :key="d+s" class="btn btn-sm me-1 mb-1"
                :class="isSlotEnabled(d,s)?'btn-danger':'btn-outline-secondary'"
                @click="toggleSlot(d,s)">{{s}}</button>
            </div>
          </div>
          <button class="btn btn-primary" @click="saveAvailability">Save Availability</button>
          <div v-if="availMsg" class="alert alert-success mt-2">{{availMsg}}</div>
        </div>
      </div>

      <!-- My Patients -->
      <div v-if="tab==='patients'">
        <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-dark"><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead>
          <tbody><tr v-for="p in patients" :key="p.id"><td>{{p.id}}</td><td>{{p.username}}</td><td>{{p.email}}</td><td>{{p.phone||'-'}}</td>
            <td><button class="btn btn-sm btn-outline-info" @click="viewPatHistory(p.id)"><i class="bi bi-clock-history"></i> History</button></td>
          </tr></tbody>
        </table>
        </div>
      </div>
      </div><!-- end v-if !patHistoryData -->

      <!-- Treatment Modal -->
      <div v-if="treatAppt" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Update Patient History</h5><button class="btn-close" @click="treatAppt=null"></button></div>
          <div class="modal-body">
            <p class="text-muted"><strong>Patient:</strong> {{treatAppt.patient_name}} | <strong>Doctor:</strong> {{treatAppt.doctor_name}}</p>
            <div class="row">
              <div class="col-md-6 mb-3"><label class="form-label">Visit Type</label><select v-model="treatForm.visit_type" class="form-select"><option value="">-- select --</option><option>In-person</option><option>Virtual</option><option>Follow-up</option></select></div>
              <div class="col-md-6 mb-3"><label class="form-label">Tests Done</label><input v-model="treatForm.tests_done" class="form-control" placeholder="ECG, Blood test…" /></div>
            </div>
            <div class="mb-3"><label class="form-label">Diagnosis *</label><textarea v-model="treatForm.diagnosis" class="form-control" rows="2"></textarea></div>
            <div class="mb-3"><label class="form-label">Prescription</label><textarea v-model="treatForm.prescription" class="form-control" rows="2"></textarea></div>
            <div class="mb-3"><label class="form-label">Medicines</label><textarea v-model="treatForm.medicines" class="form-control" rows="2" placeholder="Medicine 1 – 1-0-1…"></textarea></div>
            <div class="mb-3"><label class="form-label">Notes</label><textarea v-model="treatForm.notes" class="form-control" rows="2"></textarea></div>
          </div>
          <div class="modal-footer"><button class="btn btn-secondary" @click="treatAppt=null">Cancel</button><button class="btn btn-primary" @click="saveTreatment">Save</button></div>
        </div></div>
      </div>
    </div>`,
    data() {
        const days = [];
        for(let i=0;i<7;i++){ const d=new Date(); d.setDate(d.getDate()+i); days.push(d.toISOString().slice(0,10)); }
        return { tab:'upcoming', upcoming:[], history:[], patients:[], patientCount:0, next7:days,
            morningSlots:['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30'],
            eveningSlots:['16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30'],
            selectedSlots:{}, availMsg:'',
            treatAppt:null, treatForm:{visit_type:'',diagnosis:'',tests_done:'',prescription:'',medicines:'',notes:''},
            patHistoryData:null };
    },
    async created() { await this.load(); },
    methods: {
        async load() {
            const [dash,hist,pats,av] = await Promise.all([
                api.get('/doctor/dashboard'), api.get('/doctor/appointments'),
                api.get('/doctor/patients'), api.get('/doctor/availability'),
            ]);
            this.upcoming=dash.data.upcoming; this.patientCount=dash.data.patient_count;
            this.history=hist.data; this.patients=pats.data;
            this.selectedSlots=av.data.availability||{};
        },
        async markStatus(id,status) { await api.put('/doctor/appointments/'+id+'/status',{status}); await this.load(); },
        openTreatment(a) {
            this.treatAppt=a;
            if(a.treatment) this.treatForm={visit_type:a.treatment.visit_type||'',diagnosis:a.treatment.diagnosis,tests_done:a.treatment.tests_done||'',prescription:a.treatment.prescription||'',medicines:a.treatment.medicines||'',notes:a.treatment.notes||''};
            else this.treatForm={visit_type:'',diagnosis:'',tests_done:'',prescription:'',medicines:'',notes:''};
        },
        async saveTreatment() { await api.post('/doctor/appointments/'+this.treatAppt.id+'/treatment',this.treatForm); this.treatAppt=null; await this.load(); },
        toggleSlot(date, time) {
            if (!this.selectedSlots[date]) this.selectedSlots[date] = [];
            const idx = this.selectedSlots[date].indexOf(time);
            if (idx > -1) this.selectedSlots[date].splice(idx, 1);
            else this.selectedSlots[date].push(time);
        },
        isSlotEnabled(date, time) { return (this.selectedSlots[date]||[]).includes(time); },
        async saveAvailability() {
            await api.put('/doctor/availability',{availability:this.selectedSlots});
            this.availMsg='Saved!'; setTimeout(()=>this.availMsg='',2000);
        },
        async viewPatHistory(pid) {
            const r = await api.get('/doctor/patients/'+pid+'/history');
            this.patHistoryData = r.data;
        },
    },
};

/* =====================================================================
   PATIENT  PAGES
   ===================================================================== */
const PatientDashboard = {
    template: `
    <div>
      <h3 class="mb-4"><i class="bi bi-person-badge"></i> Patient Dashboard</h3>

      <ul class="nav nav-tabs mb-3">
        <li class="nav-item"><a class="nav-link" :class="{active:tab==='departments'}" href="#" @click.prevent="tab='departments';deptView='list'">Departments</a></li>
        <li class="nav-item"><a class="nav-link" :class="{active:tab==='appointments'}" href="#" @click.prevent="tab='appointments'">My Appointments</a></li>
        <li class="nav-item"><a class="nav-link" :class="{active:tab==='history'}" href="#" @click.prevent="tab='history'">Patient History</a></li>
        <li class="nav-item"><a class="nav-link" :class="{active:tab==='profile'}" href="#" @click.prevent="tab='profile'">Profile</a></li>
      </ul>

      <!-- ── Departments Tab ── -->
      <div v-if="tab==='departments'">

        <!-- Department List -->
        <div v-if="deptView==='list'">
          <div class="row g-3">
            <div v-for="d in departments" :key="d.id" class="col-md-4">
              <div class="card shadow h-100">
                <div class="card-body">
                  <h5 class="card-title"><i class="bi bi-building-fill-cross text-primary"></i> {{d.name}}</h5>
                  <p class="card-text text-muted small">{{d.description||'Department of '+d.name}}</p>
                  <span class="badge bg-info me-2">{{d.doctor_count}} Doctors</span>
                </div>
                <div class="card-footer"><button class="btn btn-primary btn-sm w-100" @click="viewDept(d)"><i class="bi bi-eye"></i> View Details</button></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Department Detail -->
        <div v-if="deptView==='detail'">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h4 class="mb-0"><i class="bi bi-building-fill-cross text-primary"></i> Department of {{selectedDept.name}}</h4>
            <button class="btn btn-secondary btn-sm" @click="deptView='list'"><i class="bi bi-arrow-left"></i> Back</button>
          </div>
          <div class="card shadow mb-4 p-3">
            <h6>Overview</h6>
            <p class="text-muted">{{selectedDept.description||'This department provides specialized medical care.'}}</p>
          </div>
          <h5>Doctors' List</h5>
          <div class="table-responsive">
            <table class="table table-hover">
              <thead class="table-dark"><tr><th>Doctor</th><th>Specialization</th><th>Experience</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="d in deptDoctors" :key="d.id">
                  <td>{{d.username}}</td><td>{{d.specialization}}</td>
                  <td>{{d.experience_years ? d.experience_years+' yrs' : '-'}}</td>
                  <td>
                    <button class="btn btn-sm btn-outline-success me-1" @click="checkAvailability(d)"><i class="bi bi-calendar-check"></i> Check Availability</button>
                    <button class="btn btn-sm btn-outline-primary" @click="viewDoctorProfile(d)"><i class="bi bi-person-circle"></i> View Details</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Doctor Profile -->
        <div v-if="deptView==='doctor'">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0">Doctor Profile</h5>
            <button class="btn btn-secondary btn-sm" @click="deptView='detail'"><i class="bi bi-arrow-left"></i> Go Back</button>
          </div>
          <div class="card shadow p-4 col-md-8">
            <div class="row">
              <div class="col-auto"><i class="bi bi-person-circle display-4 text-primary"></i></div>
              <div class="col">
                <h4>Dr. {{selectedDoctor.username}}</h4>
                <p class="mb-1"><strong>{{selectedDoctor.qualification||'MBBS'}}</strong> – {{selectedDoctor.specialization}}</p>
                <p class="mb-1 text-muted">{{selectedDoctor.department||'General'}}</p>
                <p v-if="selectedDoctor.experience_years" class="mb-1"><i class="bi bi-award"></i> {{selectedDoctor.experience_years}} Years Experience</p>
                <p v-if="selectedDoctor.bio" class="mt-2">{{selectedDoctor.bio}}</p>
              </div>
            </div>
            <div class="mt-3">
              <button class="btn btn-success me-2" @click="checkAvailability(selectedDoctor)"><i class="bi bi-calendar-check"></i> Check Availability</button>
              <button class="btn btn-secondary" @click="deptView='detail'"><i class="bi bi-arrow-left"></i> Go Back</button>
            </div>
          </div>
        </div>

        <!-- Doctor Availability / Slot Booking -->
        <div v-if="deptView==='slots'">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0">Availability – Dr. {{selectedDoctor.username}}</h5>
            <button class="btn btn-sm btn-secondary" @click="deptView='detail'"><i class="bi bi-arrow-left"></i> Back</button>
          </div>
          <div v-if="!Object.keys(selectedDoctorSlots).length" class="alert alert-warning">No slots available at this time.</div>
          <div v-for="(slots,date) in selectedDoctorSlots" :key="date" class="mb-3 border rounded p-2">
            <div class="fw-bold mb-2">{{date}}</div>
            <div class="d-flex flex-wrap gap-2">
              <button v-for="s in slots" :key="date+s"
                class="btn btn-sm"
                :class="isSlotBooked(date,s)?'btn-secondary disabled':(isMorning(s)?'btn-success':'btn-danger')"
                :disabled="isSlotBooked(date,s)"
                @click="bookSlot(date,s)">{{s}}</button>
            </div>
          </div>
        </div>

      </div>

      <!-- ── My Appointments Tab ── -->
      <div v-if="tab==='appointments'">
        <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-dark"><tr><th>Date</th><th>Time</th><th>Doctor</th><th>Dept</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="a in appointments" :key="a.id">
              <td>{{a.appointment_date}}</td><td>{{a.appointment_time}}</td><td>{{a.doctor_name}}</td><td>{{a.doctor_specialization}}</td>
              <td><span class="badge" :class="{'bg-primary':a.status==='booked','bg-success':a.status==='completed','bg-danger':a.status==='cancelled'}">{{a.status}}</span></td>
              <td v-if="a.status==='booked'">
                <button class="btn btn-sm btn-warning me-1" @click="openReschedule(a)"><i class="bi bi-calendar"></i> Reschedule</button>
                <button class="btn btn-sm btn-danger" @click="cancelAppt(a.id)"><i class="bi bi-x-circle"></i> Cancel</button>
              </td>
              <td v-else>-</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <!-- ── Patient History Tab ── -->
      <div v-if="tab==='history'">
        <div class="mb-3 text-end"><button class="btn btn-outline-primary" @click="exportCSV"><i class="bi bi-download"></i> Export as CSV</button></div>
        <div v-if="exportMsg" class="alert alert-info">{{exportMsg}}</div>
        <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-dark"><tr><th>#</th><th>Date</th><th>Doctor</th><th>Visit Type</th><th>Tests Done</th><th>Diagnosis</th><th>Prescription</th><th>Medicines</th></tr></thead>
          <tbody>
            <tr v-for="(a,i) in treatments" :key="a.id">
              <td>{{i+1}}</td><td>{{a.appointment_date}}</td><td>{{a.doctor_name}}</td>
              <td>{{a.treatment?.visit_type||'-'}}</td><td>{{a.treatment?.tests_done||'-'}}</td>
              <td>{{a.treatment?.diagnosis}}</td><td>{{a.treatment?.prescription||'-'}}</td>
              <td>{{a.treatment?.medicines||'-'}}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <!-- ── Profile Tab ── -->
      <div v-if="tab==='profile'">
        <div class="card shadow p-3 col-md-6">
          <div v-if="profileMsg" class="alert alert-success">{{profileMsg}}</div>
          <div class="mb-3"><label class="form-label">Username</label><input v-model="profile.username" class="form-control" /></div>
          <div class="mb-3"><label class="form-label">Phone</label><input v-model="profile.phone" class="form-control" /></div>
          <div class="mb-3"><label class="form-label">Address</label><input v-model="profile.address" class="form-control" /></div>
          <div class="mb-3"><label class="form-label">Date of Birth</label><input v-model="profile.date_of_birth" class="form-control" type="date"/></div>
          <button class="btn btn-primary" @click="saveProfile">Update Profile</button>
        </div>
      </div>

      <!-- Reschedule Modal -->
      <div v-if="rescheduleAppt" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.5)">
        <div class="modal-dialog"><div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Reschedule Appointment</h5><button class="btn-close" @click="rescheduleAppt=null"></button></div>
          <div class="modal-body">
            <div v-if="rescheduleErr" class="alert alert-danger">{{rescheduleErr}}</div>
            <div v-if="!Object.keys(rescheduleSlots).length" class="text-muted">No slots available.</div>
            <div v-for="(slots,date) in rescheduleSlots" :key="date" class="mb-2">
              <strong>{{date}}</strong>
              <div class="d-flex flex-wrap gap-2 mt-1">
                <button v-for="s in slots" :key="date+s"
                  class="btn btn-sm"
                  :class="isMorning(s)?'btn-outline-success':'btn-outline-danger'"
                  @click="confirmReschedule(date,s)">{{s}}</button>
              </div>
            </div>
          </div>
          <div class="modal-footer"><button class="btn btn-secondary" @click="rescheduleAppt=null">Cancel</button></div>
        </div></div>
      </div>
    </div>`,
    data() {
        return {
            tab:'departments',
            // Departments flow
            departments:[], deptView:'list', selectedDept:null, deptDoctors:[],
            selectedDoctor:null, selectedDoctorSlots:{}, bookedSlots:{},
            // Appointments
            appointments:[],
            // History / treatments
            treatments:[], exportMsg:'',
            // Profile
            profile:{ username:'',phone:'',address:'',date_of_birth:'' }, profileMsg:'',
            // Reschedule
            rescheduleAppt:null, rescheduleSlots:{}, rescheduleErr:'',
        };
    },
    async created() { await this.load(); },
    methods: {
        async load() {
            const [ap, tr, deps, me] = await Promise.all([
                api.get('/patient/appointments'), api.get('/patient/treatments'),
                api.get('/patient/departments'), api.get('/auth/me'),
            ]);
            this.appointments=ap.data; this.treatments=tr.data; this.departments=deps.data;
            const u=me.data.user; const p=u.patient||{};
            this.profile={ username:u.username, phone:p.phone||'', address:p.address||'', date_of_birth:p.date_of_birth||'' };
        },
        async viewDept(dept) {
            this.selectedDept=dept;
            const r=await api.get('/patient/departments/'+dept.id);
            this.deptDoctors=r.data.doctors;
            this.deptView='detail';
        },
        viewDoctorProfile(d) { this.selectedDoctor=d; this.deptView='doctor'; },
        async checkAvailability(d) {
            this.selectedDoctor=d;
            const r=await api.get('/patient/doctors/'+d.id+'/availability');
            this.selectedDoctorSlots=r.data.availability||{};
            this.bookedSlots={};
            for(const a of this.appointments){ if(a.status!=='cancelled' && a.doctor_id===d.id) this.bookedSlots[a.appointment_date+'_'+a.appointment_time]=true; }
            this.deptView='slots';
        },
        isMorning(time) { const h=parseInt(time.split(':')[0]); return h<13; },
        isSlotBooked(date,time) { return !!this.bookedSlots[date+'_'+time]; },
        async bookSlot(date,time) {
            try {
                await api.post('/patient/appointments',{doctor_id:this.selectedDoctor.id,appointment_date:date,appointment_time:time});
                alert('Appointment booked!'); await this.load(); this.tab='appointments';
            } catch(e){ alert(e.response?.data?.msg||'Booking failed'); }
        },
        async cancelAppt(id) { if(!confirm('Cancel appointment?')) return; await api.put('/patient/appointments/'+id+'/cancel'); await this.load(); },
        async openReschedule(a) {
            this.rescheduleAppt=a; this.rescheduleErr='';
            const r=await api.get('/patient/doctors/'+a.doctor_id+'/availability');
            this.rescheduleSlots=r.data.availability||{};
        },
        async confirmReschedule(date,time) {
            this.rescheduleErr='';
            try {
                await api.put('/patient/appointments/'+this.rescheduleAppt.id+'/reschedule',{appointment_date:date,appointment_time:time});
                this.rescheduleAppt=null; await this.load();
            } catch(e){ this.rescheduleErr=e.response?.data?.msg||'Failed'; }
        },
        async saveProfile() {
            await api.put('/patient/profile',this.profile);
            this.profileMsg='Profile updated!'; setTimeout(()=>this.profileMsg='',2000);
        },
        async exportCSV() {
            try { await api.post('/patient/treatments/export'); this.exportMsg='Export started! You will receive an email when ready.'; setTimeout(()=>this.exportMsg='',5000); }
            catch(e){ alert('Export failed'); }
        },
    },
};

/* =====================================================================
   HOME
   ===================================================================== */
const HomePage = {
    template: `
    <div class="text-center py-5">
      <h1><i class="bi bi-hospital"></i> Hospital Management System</h1>
      <p class="lead text-muted">A complete solution for managing appointments, doctors, patients and treatments.</p>
      <div class="mt-4">
        <router-link v-if="!loggedIn" to="/login" class="btn btn-primary btn-lg me-2">Login</router-link>
        <router-link v-if="!loggedIn" to="/register" class="btn btn-outline-primary btn-lg">Register</router-link>
        <router-link v-if="loggedIn" :to="dashPath" class="btn btn-primary btn-lg">Go to Dashboard</router-link>
      </div>
    </div>`,
    computed: {
        loggedIn() { return Auth.loggedIn; },
        dashPath() { return { admin:'/admin', doctor:'/doctor', patient:'/patient' }[Auth.role] || '/login'; },
    },
};

/* =====================================================================
   ROUTER
   ===================================================================== */
const routes = [
    { path: '/', component: HomePage },
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegisterPage },
    { path: '/admin', component: AdminDashboard, meta: { role: 'admin' } },
    { path: '/doctor', component: DoctorDashboard, meta: { role: 'doctor' } },
    { path: '/patient', component: PatientDashboard, meta: { role: 'patient' } },
];

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes,
});

router.beforeEach((to, from, next) => {
    if (to.meta.role && (!Auth.loggedIn || Auth.role !== to.meta.role)) {
        return next('/login');
    }
    next();
});

/* =====================================================================
   APP
   ===================================================================== */
const app = Vue.createApp({
    template: `<Navbar /><div class="container"><router-view /></div>`,
    components: { Navbar },
});

app.use(router);
app.mount('#app');
