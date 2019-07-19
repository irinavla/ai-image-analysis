import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  ElementRef,
  Input,
  ViewChild
} from '@angular/core';
import { AnalysisCompleteComponent } from './../analysis-complete/analysis-complete.component';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Store } from '@ngrx/store';
import { AppState, selectClarifaiState, selectAuthState, selectLayoutState, selectQualityLogState } from '../../store/app.states';
import { ApiService } from './../../services/api.service';
import 'webrtc-adapter';

import * as _ from 'lodash';
import { PhotoQuality, PerfectPint, ClearState } from '../../store/actions/clarifai.actions';
import { Observable } from 'rxjs/Observable';
import { environment } from './../../../environments/environment';

import imageCompression from 'browser-image-compression';

declare var analytics: any;
declare var loadImage: any;

@Component({
  selector: 'app-analyze-pint',
  templateUrl: './analyze-pint.component.html',
  styleUrls: ['./analyze-pint.component.scss']
})
export class AnalyzePintTestComponent implements OnInit, OnDestroy {
  @Input() hideElement: any;
  @Input() qualityCheckAnswers: any;
  @ViewChild(AnalysisCompleteComponent) child: AnalysisCompleteComponent;

  @ViewChild('uploadedImage') uploadedImage: ElementRef;

  files: FileList; // use files: FileList for multiple images
  video: HTMLVideoElement;
  // https://stackoverflow.com/questions/30830268/how-to-make-filereader-work-with-angular2
  base64: any;
  imageOrientation: any;
  rotatedImage: any;
  color = '#e51837';
  mode = 'indeterminate';
  value = 10;
  concepts: any;
  qualityCheck = { status: '', reason: [] };
  responseFromClarifai;
  captured = false;
  animationDone;
  hidePreview = true;
  analyzing;
  showThis = false;

  userRole: string;
  isLoggedIn: boolean;
  showRemember: boolean;
  getState: Observable<any>;
  getUser: Observable<any>;
  logState: Observable<any>;
  fullCheck: boolean;
  clarifaiState: Observable<any>;
  pubName: string = '';
  checkId: string;
  analysisPass;
  sub;
  error;

  imageChangedEvent: any = '';
  croppedImage: any = '';
  cropperReady = false;
  cropperVisible = true;

  imageFails: any = [];
  photoQuality;

  binaryFile;
  feedback = [];

  @Output() updateHeading = new EventEmitter();

  constructor(
    private router: Router,
    private location: Location,
    private api: ApiService,
    private store: Store<AppState>, ) {
    this.getUser = this.store.select(selectAuthState);
    this.getState = this.store.select(selectLayoutState);
    this.clarifaiState = this.store.select(selectClarifaiState);
    this.logState = this.store.select(selectQualityLogState);
  }

  ngOnInit() {
    this.video = document.querySelector('video');

    this.getState.subscribe((state) => {
      this.showRemember = state.showRemember;
      this.fullCheck = state.fullQualityCheck;
    });
    this.getUser.subscribe((state) => {
      this.isLoggedIn = state.isAuthenticated;
      this.userRole = state.isAuthenticated ? state.user.role : 'retailer';
    });

    this.logState
      .subscribe((state: any) => {
        this.pubName = state.location;
        this.checkId = state.checkId;
      });
  }

  sendFeedback() {
    let data = {
      base64: this.binaryFile,
      concepts: this.feedback
    };
    this.api.sendFeedback(data)
      .then(response => response)
      .catch(err => err);
  }


  fileChangeEvent(event: any): void {
    this.imageChangedEvent = event;
    this.handleFileSelect(event);
  }
  imageCropped(image: string) {
    this.croppedImage = image;
  }
  imageLoaded() {
    this.cropperReady = true;
    this.hideElement = true;
    this.showThis = true;
    analytics.track('Took AI Photo', {
      check_id: this.checkId,
      pub_name: this.pubName
    });
  }
  imageLoadFailed() {
    console.log('Load failed');
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
  }

  changeListener($event): void {
    this.handleFileSelect($event);
    this.pauseVideo();
    this.readFile($event.target);
  }

  refresh(): void {
    window.location.reload();
  }

  goBack() {
    if (this.showRemember === false) {
      this.router.navigate(['/publican-account']);
    } else {
      this.router.navigate(['/perfect-pour-tutorial']);
    }
  }

  closeCropper() {
    this.cropperReady = false;
    this.hideElement = false;
    this.showThis = false;
    this.base64 = false;
  }


  goToHomepage() {
    analytics.track('Cancelled Check', {
      check_id: this.checkId,
      pub_name: this.pubName
    });
    if (this.isLoggedIn) {
      this.router.navigate(['/login-welcome']);
    } else {
      this.router.navigate(['/publican-account']);
    }
  }

  pauseVideo() {
    const video = document.querySelector('video');
    this.video = video;
    this.video.pause();
    this.router.navigate(['/']);
  }

  readFile(inputValue: any): void {
    const file: File = inputValue.files[0];
    if (file) {
      this.uploadedImage.nativeElement.src = URL.createObjectURL(file);
      this.hideElement = true;
      this.hidePreview = false;
      this.showThis = true;
    }
  }

  handleFileSelect = (evt) => {
    let file = evt.target.files[0];
    loadImage(
      file,
      function (data) {
        this.base64 = data.toDataURL().replace('data:image/png;base64,', '');
      },
      {
        maxWidth: 600,
        orientation: true
      }
    );
  }

  compressFile = (file) => {
    let maxSizeMB = 1,
      maxWidthOrHeight = 1920; // compressedFile will scale down by ratio to a point that width or height is smaller than maxWidthOrHeight
    imageCompression(file, maxSizeMB, maxWidthOrHeight) // maxSizeMB, maxWidthOrHeight are optional
      .then(function (compressedFile) {
        this.convertToBinary(compressedFile); console.log(compressedFile);
      })
      .catch(function (error) {
        console.log(error.message);
      });
  }

  convertToBinary(file) {
    let reader = new FileReader();
    reader.onload = this._handleReaderLoaded.bind(this);
    reader.readAsBinaryString(file);
  }

  _handleReaderLoaded(readerEvt) {
    let binaryString = readerEvt.target.result;
    this.base64 = btoa(binaryString);
  }

  takePhoto() {
    this.router.navigate(['camera-overlay']);
  }

  analyze() {
    this.captured = false;
    this.analyzing = true;
    this.hidePreview = true;
    this.showThis = false;
    this.cropperVisible = false;
    this.responseFromClarifai = false;
    this.store.dispatch(new ClearState());
    let int = setInterval(() => {
      if (this.responseFromClarifai) {

        setTimeout(() => {
          if (!this.isLoggedIn) {
            if (!this.fullCheck) {
              this.router.navigate(['/analysis-complete-retailer']);
            }
            else {
              if (this.analysisPass) {
                this.router.navigate(['/analysis-pass']);
              } else {
                this.router.navigate(['/analysis-fail']);
              }
            }
          } else {
            if (this.analysisPass) {
              this.router.navigate(['/analysis-pass']);
            } else {
              this.router.navigate(['/analysis-fail']);
            }
          }
        }, 3000);
        clearInterval(int);
      } else if (this.error) {
        clearInterval(int);
      }
    }, 1000);

    this.sub = this.clarifaiState.subscribe((state) => {
      this.binaryFile = state.binaryFile;

      // There has been an error with the API calls
      if (state.errorMessage) {
        this.error = true;
        return this.router.navigate(['/error-messages/image-error']);
      }
      // Analysis has been completed for all of the 5 models
      if (state.analysisComplete) {
        this.responseFromClarifai = true;
        this.analysisPass = this.determinePhotoAnalysisStatus(state);
        this.sendFeedback();
        console.log(this.analysisPass);

        analytics.track('Completed AI Analysis', {
          check_id: this.checkId,
          result: true,
          pub_name: this.pubName,
          explanation: 'AI assisted crafted presentation check'
        });

      } else if (state['Photo Quality']) {
        // API call returned Success and First model has passed
        if (this._checkPhotoQuality(state['Photo Quality'])) {
          this.store.dispatch(new PerfectPint(this.base64));
          // API call returned Success but First model failed
        } else {
          this.error = true;
          this.showErrorScreen(state['Photo Quality']);
        }
      }
    });
    this.store.dispatch(new PhotoQuality(this.base64));
  }

  determinePhotoAnalysisStatus(state: any) {
    let treshold = (environment as any).clarifai.treshold,
      fails = [
        {
          'concept': 'Small Head',
          'conceptParent': 'Head Height',
          'value': 'false'
        },
        {
          'concept': 'Large Head',
          'conceptParent': 'Head Height',
          'value': 'false'
        },
        {
          'concept': 'Incorrect Glassware',
          'conceptParent': 'Glassware',
          'value': 'false'
        },
        {
          'concept': 'No Dome',
          'conceptParent': 'Dome',
          'value': 'false'
        },
        {
          'concept': 'Dirty Glass',
          'conceptParent': 'Cleanliness',
          'value': 'false'
        },
        {
          'concept': 'Overspill',
          'conceptParent': 'Dome',
          'value': 'false'
        },
        {
          'concept': 'Underpour',
          'conceptParent': 'Dome',
          'value': 'false'
        }
      ];
    let status = true;
    _.each(fails, (fail: any) => {
      if (state[fail.conceptParent][fail.concept] >= treshold) {
        console.log(fail.concept);
        console.log(state[fail.conceptParent][fail.concept]);
        status = false;
        fail.value = 'true';
      }

      this.feedback.push({ id: fail.concept, value: fail.value });
    });
    return status;
  }

  showErrorScreen(state: any) {
    let treshold = (environment as any).clarifai.treshold;

    if (state['Too dark'] >= treshold) {
      analytics.track('Failed AI Analysis', {
        check_id: this.checkId,
        pub_name: this.pubName,
        fail_reason: 'Too dark'
      });
      return this.router.navigate(['/error-messages/too-dark']);
    }
    if (state['Half Drunk'] >= treshold) {
      analytics.track('Failed AI Analysis', {
        check_id: this.checkId,
        pub_name: this.pubName,
        fail_reason: 'Half Drunk'
      });
      return this.router.navigate(['/error-messages/half-drunk']);
    }
    if (state['Multiple Glasses'] >= treshold) {
      analytics.track('Failed AI Analysis', {
        check_id: this.checkId,
        pub_name: this.pubName,
        fail_reason: 'Multiple Glasses'
      });
      return this.router.navigate(['/error-messages/too-many-glasses']);
    }
    if (state['Not Guinness'] >= treshold) {
      analytics.track('Failed AI Analysis', {
        check_id: this.checkId,
        pub_name: this.pubName,
        fail_reason: 'Incorrect beer type'
      });
      return this.router.navigate(['/error-messages/incorrect-beer']);
    }
    if (state['Out of focus'] >= treshold) {
      analytics.track('Failed AI Analysis', {
        check_id: this.checkId,
        pub_name: this.pubName,
        fail_reason: 'Out of focus'
      });
      return this.router.navigate(['/error-messages/image-error']);
    }
    return this.router.navigate(['/error-messages/image-error']);
  }

  /**
   * Checks if the photo is readable by Clarifai API.
   * If Clear concept is below the treshold or any other concept is present then it's a fail. 
   * @param {object} item
   *   Clarifai response for the 'Photo Quality' model
   * @returns {boolean}
   */
  _checkPhotoQuality(item): boolean {
    return _.every(Object.keys(item), (key) => {
      return (key !== 'Clear' && item[key] < (environment as any).clarifai.treshold) || item['Clear'] >= (environment as any).clarifai.treshold;
    });
  }

}